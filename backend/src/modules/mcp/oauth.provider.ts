import { randomBytes, randomUUID } from "node:crypto";
import type { Response } from "express";
import type { Redis } from "ioredis";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { InvalidGrantError, InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { AdminModel } from "../admins/admin.model.js";
import { AiTokenModel, OAuthClientModel, hashToken, newToken } from "./mcp.models.js";

const ACCESS_TTL_SEC = 60 * 60; // 1 hour
const REFRESH_TTL_SEC = 30 * 86_400; // 30 days (rotated on every use)
const REQ_TTL_SEC = 10 * 60;
const CODE_TTL_SEC = 5 * 60;

export interface PendingAuthorization {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scopes: string[];
}
interface IssuedCode {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  agentId: string;
  approvedBy: string;
  scopes: string[];
}

export const pendingKey = (id: string) => `oauth:req:${id}`;
const codeKey = (c: string) => `oauth:code:${c}`;

/** Issues an access + rotating refresh token for an AI agent. */
export async function issueTokens(agentId: string, client: { clientId: string; clientName?: string }, scopes: string[]): Promise<OAuthTokens> {
  const at = newToken("at");
  const rt = newToken("rt");
  const now = Date.now();
  await AiTokenModel.insertMany([
    { type: "access", hash: at.hash, prefix: at.prefix, agent: agentId, clientId: client.clientId, clientName: client.clientName, scopes, expiresAt: new Date(now + ACCESS_TTL_SEC * 1000) },
    { type: "refresh", hash: rt.hash, prefix: rt.prefix, agent: agentId, clientId: client.clientId, clientName: client.clientName, scopes, expiresAt: new Date(now + REFRESH_TTL_SEC * 1000) },
  ]);
  return { access_token: at.token, token_type: "bearer", expires_in: ACCESS_TTL_SEC, refresh_token: rt.token, scope: scopes.join(" ") };
}

/**
 * OAuth 2.1 authorization server for MCP hosts (claude.ai custom connectors, ChatGPT connectors).
 * Dynamic client registration + authorization code with PKCE (validated by the SDK) + refresh rotation.
 * The human approval step happens on our consent page (/oauth/consent), which requires a signed-in admin.
 */
export class SghOAuthProvider implements OAuthServerProvider {
  constructor(private readonly redis: Redis) {}

  readonly clientsStore: OAuthRegisteredClientsStore = {
    getClient: async (clientId: string) => {
      const c = await OAuthClientModel.findOne({ clientId }).lean();
      return (c?.info as OAuthClientInformationFull | undefined) ?? undefined;
    },
    registerClient: async (client) => {
      const full = { ...client, client_id: randomUUID(), client_id_issued_at: Math.floor(Date.now() / 1000) } as OAuthClientInformationFull;
      await OAuthClientModel.create({ clientId: full.client_id, info: full });
      return full;
    },
  };

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const id = randomBytes(18).toString("base64url");
    const pending: PendingAuthorization = {
      clientId: client.client_id,
      clientName: client.client_name ?? "AI assistant",
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state,
      scopes: params.scopes?.length ? params.scopes : ["mcp"],
    };
    await this.redis.set(pendingKey(id), JSON.stringify(pending), "EX", REQ_TTL_SEC);
    res.redirect(302, `/oauth/consent?req=${encodeURIComponent(id)}`);
  }

  /** Called by the consent page after an admin approves. Returns the redirect URL with the code. */
  async approve(requestId: string, agentId: string, approvedBy: string): Promise<string> {
    const raw = await this.redis.getdel(pendingKey(requestId));
    if (!raw) throw new InvalidGrantError("Authorization request expired");
    const p = JSON.parse(raw) as PendingAuthorization;
    const code = randomBytes(24).toString("base64url");
    const issued: IssuedCode = { clientId: p.clientId, redirectUri: p.redirectUri, codeChallenge: p.codeChallenge, agentId, approvedBy, scopes: p.scopes };
    await this.redis.set(codeKey(code), JSON.stringify(issued), "EX", CODE_TTL_SEC);
    const url = new URL(p.redirectUri);
    url.searchParams.set("code", code);
    if (p.state) url.searchParams.set("state", p.state);
    return url.toString();
  }

  async deny(requestId: string): Promise<string | null> {
    const raw = await this.redis.getdel(pendingKey(requestId));
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingAuthorization;
    const url = new URL(p.redirectUri);
    url.searchParams.set("error", "access_denied");
    if (p.state) url.searchParams.set("state", p.state);
    return url.toString();
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string): Promise<string> {
    const raw = await this.redis.get(codeKey(code));
    if (!raw) throw new InvalidGrantError("Invalid authorization code");
    const c = JSON.parse(raw) as IssuedCode;
    if (c.clientId !== client.client_id) throw new InvalidGrantError("Code was issued to another client");
    return c.codeChallenge;
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, code: string, _verifier?: string, redirectUri?: string): Promise<OAuthTokens> {
    const raw = await this.redis.getdel(codeKey(code)); // single use
    if (!raw) throw new InvalidGrantError("Invalid or used authorization code");
    const c = JSON.parse(raw) as IssuedCode;
    if (c.clientId !== client.client_id) throw new InvalidGrantError("Code was issued to another client");
    if (redirectUri && redirectUri !== c.redirectUri) throw new InvalidGrantError("redirect_uri mismatch");
    return issueTokens(c.agentId, { clientId: client.client_id, clientName: client.client_name }, c.scopes);
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    const t = await AiTokenModel.findOneAndUpdate(
      { hash: hashToken(refreshToken), type: "refresh", clientId: client.client_id, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
      { $set: { revokedAt: new Date() } }, // rotation: each refresh token works once
    );
    if (!t) throw new InvalidGrantError("Invalid refresh token");
    const agent = await AdminModel.findById(t.agent).select("status kind").lean();
    if (!agent || agent.status !== "active" || agent.kind !== "ai_agent") throw new InvalidGrantError("AI agent disabled");
    return issueTokens(String(t.agent), { clientId: client.client_id, clientName: client.client_name }, t.scopes);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    return verifyAgentToken(token);
  }

  async revokeToken(_client: OAuthClientInformationFull, req: OAuthTokenRevocationRequest): Promise<void> {
    await AiTokenModel.updateOne({ hash: hashToken(req.token), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  }
}

/** Verifies OAuth access tokens and personal tokens. AuthInfo.extra carries the AI agent id. */
export async function verifyAgentToken(token: string): Promise<AuthInfo> {
  if (!/^sgh_(at|pat)_[\w-]{20,}$/.test(token)) throw new InvalidTokenError("Invalid token");
  const t = await AiTokenModel.findOne({ hash: hashToken(token), type: { $in: ["access", "personal"] }, revokedAt: { $exists: false } }).lean();
  if (!t || (t.expiresAt && t.expiresAt.getTime() < Date.now())) throw new InvalidTokenError("Invalid or expired token");
  const agent = await AdminModel.findById(t.agent).select("status kind").lean();
  if (!agent || agent.status !== "active" || agent.kind !== "ai_agent") throw new InvalidTokenError("AI agent disabled");
  if (!t.lastUsedAt || Date.now() - t.lastUsedAt.getTime() > 60_000) await AiTokenModel.updateOne({ _id: t._id }, { $set: { lastUsedAt: new Date() } });
  return {
    token,
    clientId: t.clientId ?? "personal-token",
    scopes: t.scopes,
    expiresAt: t.expiresAt ? Math.floor(t.expiresAt.getTime() / 1000) : undefined,
    extra: { agentId: String(t.agent), tokenId: String(t._id) },
  };
}
