import { randomBytes } from "node:crypto";
import { Router } from "express";
import type { Redis } from "ioredis";
import { z } from "zod";
import { objectIdSchema, slugify } from "@sgh/shared";
import { badRequest, notFound } from "../../lib/errors.js";
import { hashPassword } from "../../lib/password.js";
import { created, noContent, ok } from "../../lib/respond.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { v, validate } from "../../middleware/validate.js";
import { audit } from "../audit/audit.service.js";
import type { SessionStore } from "../auth/session.service.js";
import { AdminModel } from "../admins/admin.model.js";
import { agentPermissionFilter } from "../admins/permissions.js";
import { RoleModel } from "../admins/role.model.js";
import { AiTokenModel, newToken } from "./mcp.models.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- lean documents */

const createSchema = z.object({ name: z.string().trim().min(2).max(80), role: objectIdSchema.optional() });
const updateSchema = z.object({ name: z.string().trim().min(2).max(80), role: objectIdSchema, status: z.enum(["active", "suspended"]) }).partial();
const tokenSchema = z.object({ name: z.string().trim().min(2).max(80), expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]).default(90) });

/** Admin → AI agents: service accounts for Claude/ChatGPT, their personal tokens and OAuth connections. */
export function aiAgentRoutes(redis: Redis, sessions: SessionStore): Router {
  const r = Router();
  r.use(requireAuth(), requirePermission("ai:manage"));

  async function loadAgent(id: string) {
    if (!/^[a-f\d]{24}$/i.test(id)) throw notFound();
    const a = await AdminModel.findOne({ _id: id, kind: "ai_agent" });
    if (!a) throw notFound();
    return a;
  }
  async function signOut(agentId: string) {
    await sessions.destroyAllForAdmin(agentId);
    await redis.del(`mcp-sess:${agentId}`);
  }
  async function pickRole(roleId?: string) {
    const role = roleId ? await RoleModel.findById(roleId).lean() : await RoleModel.findOne({ key: "ai_agent" }).lean();
    if (!role) throw badRequest("Unknown role.", [{ path: "role", message: "Unknown role" }]);
    return role;
  }

  r.get("/", async (_req, res) => {
    const agents = await AdminModel.find({ kind: "ai_agent" }).populate("role", "key name permissions").sort({ createdAt: 1 }).lean();
    const now = new Date();
    const live = { revokedAt: { $exists: false }, $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] };
    const tokens = await AiTokenModel.find({ agent: { $in: agents.map((a) => a._id) }, type: { $in: ["personal", "refresh"] }, ...live }).sort({ createdAt: -1 }).lean();
    ok(
      res,
      agents.map((a: any) => {
        const mine = tokens.filter((t) => String(t.agent) === String(a._id));
        const connections = new Map<string, any>();
        for (const t of mine.filter((t) => t.type === "refresh")) if (!connections.has(t.clientId!)) connections.set(t.clientId!, { clientId: t.clientId, clientName: t.clientName, connectedAt: t.createdAt, lastUsedAt: t.lastUsedAt });
        return {
          id: String(a._id),
          name: a.name,
          status: a.status,
          role: a.role ? { id: String(a.role._id), key: a.role.key, name: a.role.name } : null,
          effectivePermissions: (a.role?.permissions ?? []).filter(agentPermissionFilter),
          createdAt: a.createdAt,
          tokens: mine.filter((t) => t.type === "personal").map((t) => ({ id: String(t._id), name: t.name, prefix: t.prefix, expiresAt: t.expiresAt ?? null, lastUsedAt: t.lastUsedAt ?? null, createdAt: t.createdAt })),
          connections: [...connections.values()],
        };
      }),
    );
  });

  r.post("/", validate({ body: createSchema }), async (req, res) => {
    const body = v<z.infer<typeof createSchema>>(req.valid.body);
    const role = await pickRole(body.role);
    const email = `${slugify(body.name) || "agent"}-${randomBytes(4).toString("hex")}@ai-agents.invalid`;
    const agent = await AdminModel.create({ name: body.name, email, passwordHash: await hashPassword(randomBytes(32).toString("base64url")), role: role._id, kind: "ai_agent", status: "active" });
    await audit(req, { action: "ai.agent_create", entityType: "admin", entityId: agent.id, summary: `${body.name} (${role.name})` });
    created(res, { id: agent.id, name: agent.name, status: agent.status });
  });

  r.patch("/:id", validate({ body: updateSchema }), async (req, res) => {
    const a = await loadAgent(String(req.params.id));
    const body = v<z.infer<typeof updateSchema>>(req.valid.body);
    if (body.name) a.name = body.name;
    if (body.role) a.role = (await pickRole(body.role))._id;
    if (body.status) a.status = body.status;
    await a.save();
    if (body.role || body.status) await signOut(a.id);
    await audit(req, { action: "ai.agent_update", entityType: "admin", entityId: a.id, changes: body });
    ok(res, { id: a.id, name: a.name, status: a.status });
  });

  /** Removes an agent: revokes every token and connection, then deletes the account. Its content stays. */
  r.delete("/:id", async (req, res) => {
    const a = await loadAgent(String(req.params.id));
    await AiTokenModel.updateMany({ agent: a._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    await signOut(a.id);
    a.status = "suspended";
    a.name = `${a.name} (removed)`;
    await a.save();
    await audit(req, { action: "ai.agent_remove", entityType: "admin", entityId: a.id });
    noContent(res);
  });

  /** Personal access token (e.g. for Claude Code). The full token is returned once and never stored. */
  r.post("/:id/tokens", validate({ body: tokenSchema }), async (req, res) => {
    const a = await loadAgent(String(req.params.id));
    if (a.status !== "active") throw badRequest("Re-activate this agent first.");
    const body = v<z.infer<typeof tokenSchema>>(req.valid.body);
    const t = newToken("pat");
    const expiresAt = body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86_400_000) : undefined;
    const doc = await AiTokenModel.create({ type: "personal", hash: t.hash, prefix: t.prefix, name: body.name, agent: a._id, clientName: body.name, scopes: ["mcp"], expiresAt, createdBy: req.session!.adminId });
    await audit(req, { action: "ai.token_create", entityType: "admin", entityId: a.id, summary: `${body.name} (${t.prefix}…)` });
    created(res, { id: doc.id, token: t.token, prefix: t.prefix, expiresAt: expiresAt ?? null });
  });

  r.delete("/:id/tokens/:tokenId", async (req, res) => {
    const a = await loadAgent(String(req.params.id));
    const result = await AiTokenModel.updateOne({ _id: String(req.params.tokenId), agent: a._id, type: "personal", revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    if (!result.modifiedCount) throw notFound();
    await audit(req, { action: "ai.token_revoke", entityType: "admin", entityId: a.id });
    noContent(res);
  });

  /** Disconnects an OAuth client (claude.ai / ChatGPT): revokes its access and refresh tokens. */
  r.delete("/:id/connections/:clientId", async (req, res) => {
    const a = await loadAgent(String(req.params.id));
    const clientId = String(req.params.clientId).slice(0, 100);
    const result = await AiTokenModel.updateMany({ agent: a._id, clientId, type: { $in: ["access", "refresh"] }, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    if (!result.modifiedCount) throw notFound();
    await audit(req, { action: "ai.disconnect", entityType: "admin", entityId: a.id, summary: clientId });
    noContent(res);
  });

  return r;
}
