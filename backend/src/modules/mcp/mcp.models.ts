import { createHash, randomBytes } from "node:crypto";
import { Schema, model, Types } from "mongoose";

/**
 * Access tokens for AI agents.
 *  - personal: created in Admin → AI agents (e.g. for Claude Code), long-lived, shown once
 *  - access / refresh: issued by the OAuth flow (claude.ai / ChatGPT connectors)
 * Only a SHA-256 hash is stored.
 */
const tokenSchema = new Schema(
  {
    type: { type: String, enum: ["personal", "access", "refresh"], required: true },
    hash: { type: String, required: true },
    prefix: { type: String, required: true },
    name: { type: String, maxlength: 80 },
    agent: { type: Types.ObjectId, ref: "Admin", required: true },
    clientId: { type: String },
    clientName: { type: String },
    scopes: { type: [String], default: ["mcp"] },
    expiresAt: { type: Date },
    revokedAt: { type: Date },
    lastUsedAt: { type: Date },
    createdBy: { type: Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true },
);
tokenSchema.index({ hash: 1 }, { unique: true });
tokenSchema.index({ agent: 1, type: 1, createdAt: -1 });
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 86_400 }); // clean up a week after expiry
export const AiTokenModel = model("AiToken", tokenSchema, "ai_tokens");

/** OAuth clients registered dynamically by MCP hosts (claude.ai, ChatGPT…). */
const clientSchema = new Schema(
  {
    clientId: { type: String, required: true },
    info: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
clientSchema.index({ clientId: 1 }, { unique: true });
export const OAuthClientModel = model("OAuthClient", clientSchema, "oauth_clients");

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export function newToken(kind: "pat" | "at" | "rt"): { token: string; hash: string; prefix: string } {
  const token = `sgh_${kind}_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 14) };
}
