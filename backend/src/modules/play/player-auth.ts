import type { RequestHandler, Response } from "express";
import type { Redis } from "ioredis";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env, isProd } from "../../config/env.js";
import { randomToken, safeEqual } from "../../lib/crypto.js";
import { AppError, forbidden, unauthenticated } from "../../lib/errors.js";
import { PlayerModel, type PlayerDoc } from "./play.models.js";

// ── Google ID token verification ────────────────────────────────────────────
export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
}
type Verifier = (credential: string) => Promise<GoogleIdentity>;

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const googleVerifier: Verifier = async (credential) => {
  if (!env.GOOGLE_CLIENT_ID) throw new AppError(503, "INTERNAL", "Player sign-in is not configured yet.");
  const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.GOOGLE_CLIENT_ID,
    algorithms: ["RS256"],
  });
  return {
    sub: String(payload.sub),
    email: String(payload.email ?? ""),
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: String(payload.name ?? ""),
    picture: String(payload.picture ?? ""),
  };
};
let verifier: Verifier = googleVerifier;
/** Tests replace Google with a fake verifier. */
export function setGoogleVerifierForTests(v: Verifier | null): void {
  verifier = v ?? googleVerifier;
}
export async function verifyGoogleCredential(credential: string): Promise<GoogleIdentity> {
  try {
    return await verifier(credential);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw unauthenticated("Google sign-in could not be verified. Please try again.");
  }
}

// ── Player sessions (separate from admin sessions) ──────────────────────────
const secure = isProd || env.SITE_URL.startsWith("https://");
export const PLAYER_COOKIE = secure ? "__Host-sgh_psid" : "sgh_psid";
const IDLE_SEC = 30 * 86_400;
const ABSOLUTE_MS = 90 * 86_400_000;
const KEY = (id: string) => `psess:${id}`;
const SET = (playerId: string) => `psess-set:${playerId}`;

export interface PlayerSession {
  playerId: string;
  csrf: string;
  createdAt: number;
  lastSeen: number;
}

export class PlayerSessionStore {
  constructor(private readonly redis: Redis) {}

  async create(playerId: string): Promise<{ id: string; data: PlayerSession }> {
    const id = randomToken(32);
    const data: PlayerSession = { playerId, csrf: randomToken(24), createdAt: Date.now(), lastSeen: Date.now() };
    await this.redis.multi().set(KEY(id), JSON.stringify(data), "EX", IDLE_SEC).sadd(SET(playerId), id).expire(SET(playerId), ABSOLUTE_MS / 1000).exec();
    return { id, data };
  }

  async get(id: string | undefined): Promise<PlayerSession | null> {
    if (!id || id.length > 100) return null;
    const raw = await this.redis.get(KEY(id));
    if (!raw) return null;
    const data = JSON.parse(raw) as PlayerSession;
    if (Date.now() - data.createdAt > ABSOLUTE_MS) {
      await this.destroy(id, data.playerId);
      return null;
    }
    if (Date.now() - data.lastSeen > 3_600_000) {
      data.lastSeen = Date.now();
      await this.redis.set(KEY(id), JSON.stringify(data), "EX", IDLE_SEC);
    }
    return data;
  }

  async destroy(id: string, playerId?: string): Promise<void> {
    const m = this.redis.multi().del(KEY(id));
    if (playerId) m.srem(SET(playerId), id);
    await m.exec();
  }

  async destroyAll(playerId: string): Promise<void> {
    const ids = await this.redis.smembers(SET(playerId));
    if (ids.length) await this.redis.del(...ids.map(KEY), SET(playerId));
  }
}

export function setPlayerCookie(res: Response, id: string): void {
  res.cookie(PLAYER_COOKIE, id, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: ABSOLUTE_MS });
}
export function clearPlayerCookie(res: Response): void {
  res.clearCookie(PLAYER_COOKIE, { httpOnly: true, secure, sameSite: "lax", path: "/" });
}

/** Loads the player session (if any). Never rejects by itself. */
export function loadPlayerSession(store: PlayerSessionStore): RequestHandler {
  return async (req, _res, next) => {
    const id = req.cookies?.[PLAYER_COOKIE] as string | undefined;
    const s = await store.get(id);
    if (s && id) {
      req.playerSession = s;
      req.playerSessionId = id;
    }
    next();
  };
}

/** Requires a signed-in, active player; loads the Player document. */
export function requirePlayer(store: PlayerSessionStore): RequestHandler {
  return async (req, res, next) => {
    const s = req.playerSession;
    if (!s) return next(unauthenticated());
    const player = await PlayerModel.findById(s.playerId);
    if (!player || player.status !== "active") {
      await store.destroy(req.playerSessionId!, s.playerId);
      clearPlayerCookie(res);
      return next(player?.status === "banned" ? forbidden("This account has been suspended.") : unauthenticated());
    }
    if (player.lastIpHash !== req.ipHash) {
      player.lastIpHash = req.ipHash;
      await PlayerModel.updateOne({ _id: player._id }, { $set: { lastIpHash: req.ipHash } });
    }
    req.player = player;
    next();
  };
}

/** Synchronizer-token CSRF check for state-changing player requests. */
export const playerCsrf: RequestHandler = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || !req.playerSession) return next();
  if (!safeEqual(req.get("x-csrf-token") ?? "", req.playerSession.csrf)) return next(forbidden("Security token missing or expired. Please reload the page."));
  next();
};

/** Public profile shape (never email, Google id or IP data). */
export function publicPlayerName(p: Pick<PlayerDoc, "status" | "ign" | "displayName"> | null | undefined): string {
  if (!p || p.status === "deleted") return "Deleted player";
  return p.ign || p.displayName || "Player";
}
