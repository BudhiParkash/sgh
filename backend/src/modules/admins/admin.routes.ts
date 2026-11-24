import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { objectIdSchema } from "@sgh/shared";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import { buildMeta, toSkip } from "../../lib/pagination.js";
import { hashPassword } from "../../lib/password.js";
import { created, noContent, ok } from "../../lib/respond.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { v, validate } from "../../middleware/validate.js";
import { audit, diff } from "../audit/audit.service.js";
import type { SessionStore } from "../auth/session.service.js";
import { AdminModel } from "./admin.model.js";
import { ALL_PERMISSIONS } from "./permissions.js";
import { RoleModel } from "./role.model.js";

const profileSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
  bio: z.string().trim().max(600).optional(),
  isPublic: z.boolean().optional(),
});
const createSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), role: objectIdSchema, profile: profileSchema.optional() });
const updateSchema = z.object({ name: z.string().trim().min(2).max(80), role: objectIdSchema, status: z.enum(["active", "suspended"]), profile: profileSchema }).partial();

function toAdminDto(a: InstanceType<typeof AdminModel> & { role: unknown }) {
  const o = a.toObject();
  const role = o.role as unknown as { _id: unknown; key: string; name: string } | null;
  return {
    id: a.id,
    name: o.name,
    email: o.email,
    role: role && typeof role === "object" && "key" in role ? { id: String(role._id), key: role.key, name: role.name } : { id: String(o.role), key: "", name: "" },
    status: o.status,
    twoFactorEnabled: Boolean(o.twoFactor?.enabled),
    lockedUntil: o.lockedUntil ?? null,
    lastLoginAt: o.lastLoginAt ?? null,
    profile: o.profile ?? null,
    createdAt: o.createdAt,
  };
}

/** Admin user & role management (Super Admin). */
export function adminUserRoutes(sessions: SessionStore): Router {
  const r = Router();
  const listSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50), q: z.string().trim().max(80).optional() });

  r.get("/", requireAuth(), requirePermission("admin:read"), validate({ query: listSchema }), async (req, res) => {
    const q = v<z.infer<typeof listSchema>>(req.valid.query);
    const filter = q.q ? { kind: { $ne: "ai_agent" as const }, $or: [{ name: new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { email: q.q.toLowerCase() }] } : { kind: { $ne: "ai_agent" as const } };
    const [items, total] = await Promise.all([AdminModel.find(filter).populate("role", "key name").sort({ name: 1 }).skip(toSkip(q)).limit(q.limit), AdminModel.countDocuments(filter)]);
    ok(res, items.map(toAdminDto), buildMeta(q, total));
  });

  /** Creates an admin with a one-time temporary password (shown once to the Super Admin). */
  r.post("/", requireAuth(), requirePermission("admin:create"), validate({ body: createSchema }), async (req, res) => {
    const body = v<z.infer<typeof createSchema>>(req.valid.body);
    const role = await RoleModel.findById(body.role);
    if (!role) throw badRequest("Unknown role.", [{ path: "role", message: "Unknown role" }]);
    if (role.key === "super_admin" && req.session!.roleKey !== "super_admin") throw forbidden();
    const temporaryPassword = randomBytes(15).toString("base64url");
    const admin = await AdminModel.create({ ...body, passwordHash: await hashPassword(temporaryPassword), status: "active" });
    await admin.populate("role", "key name");
    await audit(req, { action: "admin.create", entityType: "admin", entityId: admin.id, summary: `${body.email} as ${role.key}` });
    created(res, { ...toAdminDto(admin), temporaryPassword });
  });

  r.patch("/:id", requireAuth(), requirePermission("admin:update"), validate({ body: updateSchema }), async (req, res) => {
    const admin = await AdminModel.findById(req.params.id);
    if (!admin) throw notFound();
    const body = v<z.infer<typeof updateSchema>>(req.valid.body);
    if (admin.id === req.session!.adminId && (body.role || body.status === "suspended")) throw badRequest("You can't change your own role or suspend yourself.");
    if (body.role) {
      const role = await RoleModel.findById(body.role);
      if (!role) throw badRequest("Unknown role.");
    }
    const before = admin.toObject();
    admin.set(body);
    await admin.save();
    // Role or status change → end their sessions so new permissions apply immediately.
    if (body.role || body.status) await sessions.destroyAllForAdmin(admin.id);
    await audit(req, { action: "admin.update", entityType: "admin", entityId: admin.id, changes: diff(before, admin.toObject()) });
    await admin.populate("role", "key name");
    ok(res, toAdminDto(admin));
  });

  r.post("/:id/unlock", requireAuth(), requirePermission("admin:update"), async (req, res) => {
    const admin = await AdminModel.findByIdAndUpdate(req.params.id, { $set: { failedLoginCount: 0 }, $unset: { lockedUntil: 1 } }, { new: true }).populate("role", "key name");
    if (!admin) throw notFound();
    await audit(req, { action: "admin.unlock", entityType: "admin", entityId: admin.id });
    ok(res, toAdminDto(admin));
  });

  r.post("/:id/force-logout", requireAuth(), requirePermission("admin:update"), async (req, res) => {
    const n = await sessions.destroyAllForAdmin(String(req.params.id));
    await audit(req, { action: "admin.force_logout", entityType: "admin", entityId: String(req.params.id), summary: `${n} sessions` });
    ok(res, { sessionsEnded: n });
  });

  r.post("/:id/reset-2fa", requireAuth(), requirePermission("admin:update"), async (req, res) => {
    if (req.session!.roleKey !== "super_admin") throw forbidden("Only a Super Admin can reset two-factor authentication.");
    const admin = await AdminModel.findById(req.params.id);
    if (!admin) throw notFound();
    admin.set("twoFactor", { enabled: false });
    await admin.save();
    await sessions.destroyAllForAdmin(admin.id);
    await audit(req, { action: "admin.reset_2fa", entityType: "admin", entityId: admin.id });
    noContent(res);
  });

  r.post("/:id/reset-password", requireAuth(), requirePermission("admin:update"), async (req, res) => {
    if (req.session!.roleKey !== "super_admin") throw forbidden();
    const admin = await AdminModel.findById(req.params.id);
    if (!admin) throw notFound();
    const temporaryPassword = randomBytes(15).toString("base64url");
    admin.passwordHash = await hashPassword(temporaryPassword);
    admin.passwordChangedAt = new Date();
    await admin.save();
    await sessions.destroyAllForAdmin(admin.id);
    await audit(req, { action: "admin.reset_password", entityType: "admin", entityId: admin.id });
    ok(res, { temporaryPassword });
  });

  r.delete("/:id", requireAuth(), requirePermission("admin:delete"), async (req, res) => {
    if (req.params.id === req.session!.adminId) throw badRequest("You can't delete your own account.");
    const admin = await AdminModel.findById(req.params.id).populate("role", "key");
    if (!admin) throw notFound();
    const role = admin.role as unknown as { key: string };
    if (role?.key === "super_admin" && (await AdminModel.countDocuments({ role: admin.get("role")._id, status: "active" })) <= 1) {
      throw conflict("You can't delete the last Super Admin.");
    }
    // Keep authorship history intact: suspend instead of hard-deleting when the admin has audit history.
    admin.status = "suspended";
    admin.email = `deleted-${admin.id}@invalid.local`;
    await admin.save();
    await sessions.destroyAllForAdmin(admin.id);
    await audit(req, { action: "admin.delete", entityType: "admin", entityId: admin.id });
    noContent(res);
  });

  return r;
}

const roleCreate = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(ALL_PERMISSIONS.length),
});

export function roleRoutes(sessions: SessionStore): Router {
  const r = Router();
  r.get("/", requireAuth(), requirePermission("role:read"), async (_req, res) => {
    const [roles, counts] = await Promise.all([RoleModel.find().sort({ isSystem: -1, name: 1 }).lean(), AdminModel.aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }])]);
    const byRole = new Map(counts.map((c) => [String(c._id), c.n as number]));
    ok(res, roles.map(({ _id, __v, ...x }) => ({ id: String(_id), ...x, memberCount: byRole.get(String(_id)) ?? 0 })));
  });
  r.get("/permissions", requireAuth(), requirePermission("role:read"), (_req, res) => ok(res, ALL_PERMISSIONS));

  r.post("/", requireAuth(), requirePermission("role:create"), validate({ body: roleCreate }), async (req, res) => {
    const body = v<z.infer<typeof roleCreate>>(req.valid.body);
    const key = `custom-${body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`.slice(0, 60);
    const role = await RoleModel.create({ ...body, key, isSystem: false });
    await audit(req, { action: "role.create", entityType: "role", entityId: role.id, summary: key });
    created(res, { id: role.id, ...role.toObject(), memberCount: 0 });
  });

  r.patch("/:id", requireAuth(), requirePermission("role:update"), validate({ body: roleCreate.partial() }), async (req, res) => {
    const role = await RoleModel.findById(req.params.id);
    if (!role) throw notFound();
    if (role.isSystem) throw badRequest("System roles can't be edited. Create a custom role instead.");
    const before = role.toObject();
    role.set(req.valid.body as object);
    role.version += 1;
    await role.save();
    // Members get new permissions on next sign-in.
    const members = await AdminModel.find({ role: role._id }).select("_id").lean();
    await Promise.all(members.map((m) => sessions.destroyAllForAdmin(String(m._id))));
    await audit(req, { action: "role.update", entityType: "role", entityId: role.id, changes: diff(before, role.toObject()) });
    ok(res, { id: role.id, ...role.toObject(), memberCount: members.length });
  });

  r.delete("/:id", requireAuth(), requirePermission("role:delete"), async (req, res) => {
    const role = await RoleModel.findById(req.params.id);
    if (!role) throw notFound();
    if (role.isSystem) throw badRequest("System roles can't be deleted.");
    if (await AdminModel.exists({ role: role._id })) throw conflict("Move this role's members to another role first.");
    await role.deleteOne();
    await audit(req, { action: "role.delete", entityType: "role", entityId: role.id });
    noContent(res);
  });
  return r;
}
