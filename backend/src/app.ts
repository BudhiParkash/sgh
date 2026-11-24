import express, { Router, type Express, type RequestHandler } from "express";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import type { Redis } from "ioredis";
import { apiDocsEnabled, env } from "./config/env.js";
import { buildOpenApiDocument } from "./docs/openapi.js";
import { csrfProtect, loadSession } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { requestContext } from "./middleware/request-context.js";
import { corsMiddleware, originGuard, rejectOperatorKeys, securityHeaders } from "./middleware/security.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import "./modules/auth/auth.docs.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { SessionStore } from "./modules/auth/session.service.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { registerModules, type AppDeps } from "./modules/index.js";
import { Cache } from "./lib/cache.js";
import { mcpRoutes } from "./modules/mcp/mcp.routes.js";

export interface CreateAppOptions {
  redis: Redis;
}

/** Express app factory (no listen) — used by server.ts and by tests. */
export function createApp({ redis }: CreateAppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY); // behind Cloudflare → Nginx
  app.set("etag", "strong");

  app.use(requestContext);
  app.use(securityHeaders);
  const sessions = new SessionStore(redis);
  // MCP + OAuth for AI assistants: own CORS/body parsing (called by claude.ai/ChatGPT servers and CLIs).
  app.use(mcpRoutes(() => app, redis, sessions));
  app.use(corsMiddleware);
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(rejectOperatorKeys);
  app.use(originGuard);

  const deps: AppDeps = { redis, sessions, cache: new Cache(redis) };
  const api = Router();

  api.use("/health", healthRoutes(redis));

  // ── Public API ────────────────────────────────────────────
  const publicApi = Router();
  publicApi.use(rateLimit(redis, { name: "public", points: 240, durationSec: 60 }));
  // ── Admin API ─────────────────────────────────────────────
  const admin = Router();
  admin.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  admin.use(loadSession(sessions));
  admin.use(rateLimit(redis, { name: "admin", points: 600, durationSec: 60, key: (req) => req.sessionId ?? req.ipHash }));
  admin.use("/auth", authRoutes(redis, sessions));
  admin.use(csrfProtect);
  admin.use("/audit-logs", auditRoutes());

  registerModules({ publicApi, admin, deps });

  api.use("/admin", admin);
  api.use("/", publicApi);

  if (apiDocsEnabled) {
    const spec = buildOpenApiDocument();
    api.get("/openapi.json", (_req, res) => res.json(spec));
    const docsCsp: RequestHandler = (_req, res, next) => {
      // Swagger UI needs inline scripts/styles — relax CSP only for this path.
      res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:");
      next();
    };
    api.use("/docs", docsCsp, swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: "SGH API docs" }));
  }

  app.use("/api/v1", api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
