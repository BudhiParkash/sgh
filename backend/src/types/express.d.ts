import type { SessionData } from "../modules/auth/session.service.js";

declare global {
  namespace Express {
    interface Request {
      /** Loaded admin session (if a valid session cookie was sent). */
      session?: SessionData;
      sessionId?: string;
      /** HMAC of the client IP — never the raw IP. */
      ipHash: string;
      /** Parsed + validated request parts (see middleware/validate). */
      valid: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
