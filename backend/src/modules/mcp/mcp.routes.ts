import express, { Router, type Express } from "express";
import cookieParser from "cookie-parser";
import type { Redis } from "ioredis";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import type { SessionStore } from "../auth/session.service.js";
import { AdminApiClient } from "./admin-client.js";
import { consentRoutes } from "./consent.routes.js";
import { buildMcpServer } from "./mcp.server.js";
import { SghOAuthProvider } from "./oauth.provider.js";

/**
 * MCP endpoint for AI assistants (claude.ai / Claude Desktop custom connectors, ChatGPT connectors,
 * Claude Code). Mounted at the app root, ahead of the JSON API middleware:
 *   /.well-known/oauth-authorization-server, /.well-known/oauth-protected-resource/mcp,
 *   /authorize, /token, /register, /revoke   (OAuth 2.1 + PKCE + dynamic client registration)
 *   /oauth/consent                           (admin approves and picks the AI agent account)
 *   POST /mcp                                (Streamable HTTP, stateless, Bearer token)
 */
export function mcpRoutes(getApp: () => Express, redis: Redis, sessions: SessionStore): Router {
  const r = Router();
  const provider = new SghOAuthProvider(redis);
  const site = new URL(env.SITE_URL);
  const resource = new URL("/mcp", site);

  r.use(
    mcpAuthRouter({
      provider,
      issuerUrl: site,
      resourceServerUrl: resource,
      scopesSupported: ["mcp"],
      resourceName: "Shivanshi Gaming Hub",
      serviceDocumentationUrl: new URL("/about", site),
    }),
  );
  r.use(cookieParser(), consentRoutes(redis, sessions, provider));

  const bearer = requireBearerAuth({ verifier: provider, resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resource) });
  const limit = rateLimit(redis, { name: "mcp", points: 300, durationSec: 60, key: (req) => String(req.auth?.extra?.agentId ?? req.ipHash) });

  r.post("/mcp", bearer, limit, express.json({ limit: "1mb" }), async (req, res) => {
    const agentId = String(req.auth!.extra!.agentId);
    const server = buildMcpServer(new AdminApiClient(getApp(), redis, sessions, agentId, req.ip));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error({ err }, "MCP request failed");
      if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
    }
  });
  // Stateless server: no SSE stream and no sessions to delete.
  r.all("/mcp", (_req, res) => {
    res.setHeader("Allow", "POST");
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  });
  return r;
}
