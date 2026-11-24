import type { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { randomToken } from "../../lib/crypto.js";

export interface SessionData {
  adminId: string;
  name: string;
  email: string;
  roleKey: string;
  permissions: string[];
  roleVersion: number;
  /** "2fa" = password OK, waiting for TOTP; "active" = fully signed in. */
  stage: "2fa" | "active";
  mustSetup2fa: boolean;
  csrf: string;
  createdAt: number;
  lastSeen: number;
  ipHash: string;
  uaHash: string;
}

const KEY = (id: string) => `sess:${id}`;
const ADMIN_SET = (adminId: string) => `admin-sess:${adminId}`;
const PENDING_2FA_TTL = 5 * 60;
const TOUCH_INTERVAL_MS = 60_000;

/** Opaque, revocable server-side sessions in Redis (docs/architecture/01 §3.3). */
export class SessionStore {
  constructor(private readonly redis: Redis) {}

  private get idleSec() {
    return env.SESSION_IDLE_MINUTES * 60;
  }
  private get absoluteMs() {
    return env.SESSION_ABSOLUTE_HOURS * 3_600_000;
  }

  async create(data: Omit<SessionData, "csrf" | "createdAt" | "lastSeen">): Promise<{ id: string; data: SessionData }> {
    const id = randomToken(32);
    const now = Date.now();
    const full: SessionData = { ...data, csrf: randomToken(24), createdAt: now, lastSeen: now };
    const ttl = data.stage === "2fa" ? PENDING_2FA_TTL : this.idleSec;
    await this.redis.multi().set(KEY(id), JSON.stringify(full), "EX", ttl).sadd(ADMIN_SET(data.adminId), id).expire(ADMIN_SET(data.adminId), Math.ceil(this.absoluteMs / 1000)).exec();
    return { id, data: full };
  }

  async get(id: string | undefined): Promise<SessionData | null> {
    if (!id || id.length > 100) return null;
    const raw = await this.redis.get(KEY(id));
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionData;
    if (Date.now() - data.createdAt > this.absoluteMs) {
      await this.destroy(id, data.adminId);
      return null;
    }
    return data;
  }

  /** Sliding idle expiry; writes at most once a minute per session. */
  async touch(id: string, data: SessionData): Promise<void> {
    if (data.stage !== "active" || Date.now() - data.lastSeen < TOUCH_INTERVAL_MS) return;
    data.lastSeen = Date.now();
    await this.redis.set(KEY(id), JSON.stringify(data), "EX", this.idleSec);
  }

  async update(id: string, data: SessionData): Promise<void> {
    const ttl = data.stage === "2fa" ? PENDING_2FA_TTL : this.idleSec;
    await this.redis.set(KEY(id), JSON.stringify(data), "EX", ttl);
  }

  /** New id, same data (fresh CSRF token) — used on privilege changes (e.g. after 2FA). */
  async rotate(oldId: string, data: SessionData, patch: Partial<SessionData> = {}): Promise<{ id: string; data: SessionData }> {
    await this.destroy(oldId, data.adminId);
    const { csrf: _c, createdAt: _ca, lastSeen: _l, ...rest } = { ...data, ...patch };
    return this.create(rest);
  }

  async destroy(id: string, adminId?: string): Promise<void> {
    const multi = this.redis.multi().del(KEY(id));
    if (adminId) multi.srem(ADMIN_SET(adminId), id);
    await multi.exec();
  }

  /** Logs an admin out everywhere (role change, password change, suspension). */
  async destroyAllForAdmin(adminId: string, exceptId?: string): Promise<number> {
    const ids = await this.redis.smembers(ADMIN_SET(adminId));
    const toDelete = ids.filter((i) => i !== exceptId);
    if (toDelete.length === 0) return 0;
    await this.redis.multi().del(...toDelete.map(KEY)).srem(ADMIN_SET(adminId), ...toDelete).exec();
    return toDelete.length;
  }

  async countForAdmin(adminId: string): Promise<number> {
    return this.redis.scard(ADMIN_SET(adminId));
  }
}
