import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import type { Redis } from "ioredis";
import { SESSION_COOKIE } from "../../middleware/auth.js";
import { AdminModel } from "../admins/admin.model.js";
import { agentPermissionFilter } from "../admins/permissions.js";
import { RoleModel } from "../admins/role.model.js";
import type { SessionStore } from "../auth/session.service.js";

export interface ApiResult<T = unknown> {
  status: number;
  ok: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string; details?: { path: string; message: string }[] };
}

const SESSION_KEY = (agentId: string) => `mcp-sess:${agentId}`;

/**
 * Private loopback listener for internal calls: started once per process on 127.0.0.1 (exclusive,
 * so PM2 cluster workers each keep their own) and unref'd so it never keeps the process alive.
 */
let loopback: Promise<string> | null = null;
function loopbackUrl(app: Express): Promise<string> {
  loopback ??= new Promise<string>((resolve, reject) => {
    const srv: Server = createServer(app);
    srv.once("error", reject);
    srv.listen({ port: 0, host: "127.0.0.1", exclusive: true }, () => {
      srv.unref();
      resolve(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`);
    });
  });
  return loopback;
}

/**
 * Calls the admin API in-process as an AI agent account. Every MCP tool goes through the same
 * routes, validation, permission checks, audit log and publish rules as the admin panel.
 */
export class AdminApiClient {
  constructor(
    private readonly app: Express,
    private readonly redis: Redis,
    private readonly sessions: SessionStore,
    readonly agentId: string,
    /** Original client IP of the MCP request (recorded in the audit log via X-Forwarded-For). */
    private readonly clientIp?: string,
  ) {}

  private async session(): Promise<{ id: string; csrf: string; permissions: string[] }> {
    const cached = await this.redis.get(SESSION_KEY(this.agentId));
    if (cached) {
      const data = await this.sessions.get(cached);
      if (data && data.adminId === this.agentId) {
        const role = await RoleModel.findOne({ key: data.roleKey }).select("version").lean();
        if (role && role.version === data.roleVersion) return { id: cached, csrf: data.csrf, permissions: data.permissions };
        await this.sessions.destroy(cached, this.agentId);
      }
    }
    const agent = await AdminModel.findById(this.agentId).lean();
    if (!agent || agent.status !== "active" || agent.kind !== "ai_agent") throw new Error("AI agent account is disabled.");
    const role = await RoleModel.findById(agent.role).lean();
    if (!role) throw new Error("AI agent has no role.");
    const { id, data } = await this.sessions.create({
      adminId: String(agent._id),
      name: agent.name,
      email: agent.email,
      roleKey: role.key,
      permissions: role.permissions.filter(agentPermissionFilter),
      roleVersion: role.version,
      stage: "active",
      mustSetup2fa: false, // service account: no password login, token-authenticated
      ipHash: "mcp",
      uaHash: "mcp",
    });
    await this.redis.set(SESSION_KEY(this.agentId), id, "EX", 3600);
    return { id, csrf: data.csrf, permissions: data.permissions };
  }

  async permissions(): Promise<string[]> {
    return (await this.session()).permissions;
  }

  async call<T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, headers: Record<string, string> = {}): Promise<ApiResult<T>> {
    const s = await this.session();
    const res = await fetch(`${await loopbackUrl(this.app)}/api/v1/admin${path}`, {
      method,
      headers: {
        cookie: `${SESSION_COOKIE}=${s.id}`,
        "x-csrf-token": s.csrf,
        "user-agent": "sgh-mcp",
        ...(this.clientIp && { "x-forwarded-for": this.clientIp }),
        ...(body !== undefined && { "content-type": "application/json" }),
        ...headers,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    return parse<T>(res);
  }

  /** Multipart upload (e.g. POST /media) through the same admin route, validation and audit as the panel. */
  async upload<T = unknown>(path: string, fields: Record<string, string | undefined>, file: { buffer: Buffer; filename: string }): Promise<ApiResult<T>> {
    const s = await this.session();
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== "") form.set(k, v);
    form.set("file", new Blob([new Uint8Array(file.buffer)]), file.filename);
    const res = await fetch(`${await loopbackUrl(this.app)}/api/v1/admin${path}`, {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE}=${s.id}`,
        "x-csrf-token": s.csrf,
        "user-agent": "sgh-mcp",
        ...(this.clientIp && { "x-forwarded-for": this.clientIp }),
      },
      body: form,
    });
    return parse<T>(res);
  }
}

async function parse<T>(res: Response): Promise<ApiResult<T>> {
  const raw = await res.text();
  let json: { data?: T; meta?: Record<string, unknown>; error?: ApiResult["error"] } = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = { error: { code: "BAD_RESPONSE", message: raw.slice(0, 200) } };
  }
  return { status: res.status, ok: res.ok, data: json.data, meta: json.meta, error: json.error };
}
