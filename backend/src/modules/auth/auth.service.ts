import { createHmac } from "node:crypto";
import QRCode from "qrcode";
import { env, required2faRoles } from "../../config/env.js";
import { decrypt, encrypt, hashIdentifier, randomToken } from "../../lib/crypto.js";
import { AppError, badRequest, unauthenticated } from "../../lib/errors.js";
import { dummyVerify, hashPassword, passwordPolicyError, verifyPassword } from "../../lib/password.js";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "../../lib/totp.js";
import { AdminModel, type AdminDoc } from "../admins/admin.model.js";
import { RoleModel } from "../admins/role.model.js";
import type { SessionData, SessionStore } from "./session.service.js";

const LOCK_STEPS: [failures: number, minutes: number][] = [
  [15, 60 * 24 * 365], // effectively until an admin unlocks
  [10, 60],
  [5, 15],
];

const recoveryHash = (code: string) => createHmac("sha256", env.HASH_SECRET).update(code.toUpperCase()).digest("base64url");

export interface LoginContext {
  ipHash: string;
  userAgent: string | undefined;
}

export type LoginResult =
  | { kind: "signed_in"; sessionId: string; session: SessionData }
  | { kind: "needs_2fa"; sessionId: string; session: SessionData };

export class AuthService {
  constructor(private readonly sessions: SessionStore) {}

  private async buildSession(admin: AdminDoc, ctx: LoginContext, stage: SessionData["stage"]) {
    const role = await RoleModel.findById(admin.role).lean();
    if (!role) throw unauthenticated("Invalid email or password.");
    return this.sessions.create({
      adminId: admin.id,
      name: admin.name,
      email: admin.email,
      roleKey: role.key,
      permissions: role.permissions,
      roleVersion: role.version,
      stage,
      mustSetup2fa: required2faRoles.includes(role.key) && !admin.twoFactor?.enabled,
      ipHash: ctx.ipHash,
      uaHash: hashIdentifier(ctx.userAgent),
    });
  }

  /**
   * Password step. Identical response and timing for unknown email, wrong password and
   * suspended accounts (no account enumeration). Locked accounts get a 429.
   */
  async login(email: string, password: string, ctx: LoginContext): Promise<LoginResult> {
    const admin = await AdminModel.findOne({ email }).select("+passwordHash +twoFactor.secretEnc");
    if (!admin) {
      await dummyVerify(password);
      throw unauthenticated("Invalid email or password.");
    }
    if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
      await dummyVerify(password);
      throw new AppError(429, "RATE_LIMITED", "Too many failed attempts. Try again later or contact a Super Admin.");
    }
    const okPw = await verifyPassword(admin.passwordHash, password);
    if (!okPw || admin.status !== "active" || admin.kind === "ai_agent") {
      if (!okPw) {
        admin.failedLoginCount = (admin.failedLoginCount ?? 0) + 1;
        const step = LOCK_STEPS.find(([n]) => admin.failedLoginCount >= n);
        if (step && LOCK_STEPS.some(([n]) => admin.failedLoginCount === n)) {
          admin.lockedUntil = new Date(Date.now() + step[1] * 60_000);
        }
        await admin.save();
      }
      throw unauthenticated("Invalid email or password.");
    }

    admin.failedLoginCount = 0;
    admin.lockedUntil = undefined;
    if (admin.twoFactor?.enabled) {
      await admin.save();
      const { id, data } = await this.buildSession(admin, ctx, "2fa");
      return { kind: "needs_2fa", sessionId: id, session: data };
    }
    admin.lastLoginAt = new Date();
    admin.lastLoginIpHash = ctx.ipHash;
    await admin.save();
    const { id, data } = await this.buildSession(admin, ctx, "active");
    return { kind: "signed_in", sessionId: id, session: data };
  }

  /** Second step: TOTP code or a single-use recovery code. Rotates the session id on success. */
  async verifySecondFactor(sessionId: string, session: SessionData, code: string): Promise<{ sessionId: string; session: SessionData; usedRecovery: boolean }> {
    if (session.stage !== "2fa") throw badRequest("Two-factor verification is not pending.");
    const admin = await AdminModel.findById(session.adminId).select("+twoFactor.secretEnc +twoFactor.lastUsedStep +twoFactor.recoveryCodeHashes");
    if (!admin?.twoFactor?.enabled || !admin.twoFactor.secretEnc) throw unauthenticated();

    let usedRecovery = false;
    if (code.includes("-")) {
      const h = recoveryHash(code);
      const codes = admin.twoFactor.recoveryCodeHashes ?? [];
      if (!codes.includes(h)) throw unauthenticated("Invalid code.");
      admin.twoFactor.recoveryCodeHashes = codes.filter((c) => c !== h);
      usedRecovery = true;
    } else {
      const step = verifyTotp(decrypt(admin.twoFactor.secretEnc), code);
      // Replay protection: a code (time-step) can be used only once.
      if (step === null || (admin.twoFactor.lastUsedStep ?? -1) >= step) throw unauthenticated("Invalid code.");
      admin.twoFactor.lastUsedStep = step;
    }
    admin.lastLoginAt = new Date();
    admin.lastLoginIpHash = session.ipHash;
    await admin.save();
    const rotated = await this.sessions.rotate(sessionId, session, { stage: "active" });
    return { sessionId: rotated.id, session: rotated.data, usedRecovery };
  }

  /** Starts TOTP enrolment: stores a pending secret, returns the otpauth URL + QR (data URL). */
  async begin2faSetup(adminId: string) {
    const admin = await AdminModel.findById(adminId).select("+twoFactor.pendingSecretEnc");
    if (!admin) throw unauthenticated();
    if (admin.twoFactor?.enabled) throw badRequest("Two-factor authentication is already enabled.");
    const secret = generateTotpSecret();
    admin.set("twoFactor.pendingSecretEnc", encrypt(secret));
    await admin.save();
    const url = otpauthUrl(secret, admin.email);
    return { secret, otpauthUrl: url, qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 240 }) };
  }

  /** Confirms enrolment with a valid code; returns one-time recovery codes (shown once). */
  async enable2fa(sessionId: string, session: SessionData, code: string) {
    const admin = await AdminModel.findById(session.adminId).select("+twoFactor.pendingSecretEnc");
    if (!admin?.twoFactor?.pendingSecretEnc) throw badRequest("Start two-factor setup first.");
    const secret = decrypt(admin.twoFactor.pendingSecretEnc);
    const step = verifyTotp(secret, code);
    if (step === null) throw badRequest("That code is not valid. Check your authenticator app's time and try again.", [{ path: "code", message: "Invalid code" }]);
    const recoveryCodes = Array.from({ length: 10 }, () => {
      const t = randomToken(8).replace(/[^A-Za-z0-9]/g, "").toUpperCase().padEnd(10, "X").slice(0, 10);
      return `${t.slice(0, 5)}-${t.slice(5)}`;
    });
    admin.set("twoFactor", {
      enabled: true,
      secretEnc: admin.twoFactor.pendingSecretEnc,
      pendingSecretEnc: undefined,
      lastUsedStep: step,
      recoveryCodeHashes: recoveryCodes.map(recoveryHash),
    });
    await admin.save();
    // Privilege state changed → rotate session; other sessions are signed out.
    await this.sessions.destroyAllForAdmin(session.adminId, sessionId);
    const rotated = await this.sessions.rotate(sessionId, session, { mustSetup2fa: false });
    return { recoveryCodes, sessionId: rotated.id, session: rotated.data };
  }

  async disable2fa(session: SessionData, password: string, code: string) {
    if (required2faRoles.includes(session.roleKey)) throw badRequest("Your role requires two-factor authentication.");
    const admin = await AdminModel.findById(session.adminId).select("+passwordHash +twoFactor.secretEnc");
    if (!admin?.twoFactor?.enabled || !admin.twoFactor.secretEnc) throw badRequest("Two-factor authentication is not enabled.");
    if (!(await verifyPassword(admin.passwordHash, password)) || verifyTotp(decrypt(admin.twoFactor.secretEnc), code) === null) {
      throw unauthenticated("Password or code is incorrect.");
    }
    admin.set("twoFactor", { enabled: false });
    await admin.save();
  }

  async changePassword(sessionId: string, session: SessionData, current: string, next: string) {
    const admin = await AdminModel.findById(session.adminId).select("+passwordHash");
    if (!admin) throw unauthenticated();
    if (!(await verifyPassword(admin.passwordHash, current))) throw badRequest("Current password is incorrect.", [{ path: "currentPassword", message: "Incorrect password" }]);
    const policy = passwordPolicyError(next, admin.email);
    if (policy) throw badRequest(policy, [{ path: "newPassword", message: policy }]);
    if (current === next) throw badRequest("Choose a new password different from the current one.", [{ path: "newPassword", message: "Same as current" }]);
    admin.passwordHash = await hashPassword(next);
    admin.passwordChangedAt = new Date();
    await admin.save();
    await this.sessions.destroyAllForAdmin(session.adminId, sessionId);
  }

  async me(session: SessionData) {
    const admin = await AdminModel.findById(session.adminId).lean();
    if (!admin) throw unauthenticated();
    return {
      id: String(admin._id),
      name: admin.name,
      email: admin.email,
      role: session.roleKey,
      permissions: session.permissions,
      twoFactorEnabled: Boolean(admin.twoFactor?.enabled),
      mustSetup2fa: session.mustSetup2fa,
      csrfToken: session.csrf,
      profile: admin.profile ?? null,
    };
  }
}
