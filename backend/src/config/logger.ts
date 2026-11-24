import { pino } from "pino";
import { env, isProd } from "./env.js";

/** Structured JSON logs with secrets/PII redacted (docs/architecture/10 §2). */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "sgh-api", env: env.SITE_ENV },
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "req.headers['x-csrf-token']",
      "res.headers['set-cookie']",
      "*.password",
      "*.passwordHash",
      "*.currentPassword",
      "*.newPassword",
      "*.token",
      "*.code",
      "*.secret",
      "*.twoFactor",
    ],
    censor: "[redacted]",
  },
  transport: !isProd && process.env.NODE_ENV !== "test" ? { target: "pino-pretty", options: { colorize: true } } : undefined,
});
