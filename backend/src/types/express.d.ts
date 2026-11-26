import type { SessionData } from "../modules/auth/session.service.js";
import type { PlayerSession } from "../modules/play/player-auth.js";
import type { PlayerModel } from "../modules/play/play.models.js";

declare global {
  namespace Express {
    interface Request {
      /** Loaded admin session (if a valid session cookie was sent). */
      session?: SessionData;
      sessionId?: string;
      /** HMAC of the client IP — never the raw IP. */
      ipHash: string;
      /** Player (public site account) session and document — see modules/play/player-auth. */
      playerSession?: PlayerSession;
      playerSessionId?: string;
      player?: InstanceType<typeof PlayerModel>;
      /** Parsed + validated request parts (see middleware/validate). */
      valid: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
