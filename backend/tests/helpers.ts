import request from "supertest";
import type { Express } from "express";
import type { RoleKey } from "@sgh/shared";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/lib/password.js";
import { totp } from "../src/lib/totp.js";
import { AdminModel } from "../src/modules/admins/admin.model.js";
import { RoleModel } from "../src/modules/admins/role.model.js";
import { ensureSystemRoles } from "../src/modules/admins/role.service.js";
import { testRedis } from "./setup.js";

export const PASSWORD = "Correct-Horse-Battery-42";

export function makeApp(): Express {
  return createApp({ redis: testRedis });
}

let ipCounter = 0;
/** Unique client IP per call (trust proxy = 1) so IP rate limits don't interfere between tests. */
export const freshIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

export async function createAdmin(roleKey: RoleKey, email = `${roleKey}@test.local`) {
  await ensureSystemRoles();
  const role = await RoleModel.findOne({ key: roleKey });
  return AdminModel.create({ name: roleKey, email, passwordHash: await hashPassword(PASSWORD), role: role!._id });
}

export interface Agent {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
  ip: string;
}

/** Signs in an admin whose role does not require 2FA (or that has 2FA disabled) and returns an agent + CSRF token. */
export async function signIn(app: Express, email: string, password = PASSWORD): Promise<Agent> {
  const ip = freshIp();
  const agent = request.agent(app);
  const res = await agent.post("/api/v1/admin/auth/login").set("X-Forwarded-For", ip).send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const me = await agent.get("/api/v1/admin/auth/me").set("X-Forwarded-For", ip);
  return { agent, csrf: me.body.data?.csrfToken ?? res.body.data.csrfToken, ip };
}

/** Signs in an admin whose role requires 2FA: enrolls TOTP on first login and returns a fully privileged agent. */
export async function signInWith2fa(app: Express, email: string): Promise<Agent & { secret: string }> {
  const a = await signIn(app, email);
  const setup = await a.agent.post("/api/v1/admin/auth/2fa/setup").set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf);
  const secret = setup.body.data.secret as string;
  const en = await a.agent.post("/api/v1/admin/auth/2fa/enable").set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf).send({ code: totp(secret) });
  if (en.status !== 200) throw new Error(`2fa enable failed: ${JSON.stringify(en.body)}`);
  return { ...a, csrf: en.body.data.csrfToken, secret };
}
