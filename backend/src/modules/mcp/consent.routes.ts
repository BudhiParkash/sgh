import express, { Router } from "express";
import { InvalidGrantError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { logger } from "../../config/logger.js";
import { safeEqual } from "../../lib/crypto.js";
import { hasPermission, loadSession } from "../../middleware/auth.js";
import { AdminModel } from "../admins/admin.model.js";
import { audit } from "../audit/audit.service.js";
import type { SessionStore } from "../auth/session.service.js";
import type { Redis } from "ioredis";
import { pendingKey, type PendingAuthorization, type SghOAuthProvider } from "./oauth.provider.js";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · Shivanshi Gaming Hub</title>
<style>body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#07070b;color:#ecedf3;display:grid;place-items:center;min-height:100vh;padding:16px}main{max-width:520px;width:100%;background:#0f1016;border:1px solid #ffffff29;border-radius:16px;padding:28px}h1{font-size:1.4rem;margin:0 0 8px}p{color:#9a9db0}label{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid #ffffff1f;border-radius:10px;margin:8px 0;cursor:pointer}small{color:#83869c}.row{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}button{min-height:44px;padding:0 20px;border-radius:10px;border:1px solid #ffffff29;background:#161823;color:#ecedf3;font:inherit;cursor:pointer}button.primary{background:#7c3aed;border-color:#7c3aed;color:#fff}a{color:#3b82f6}.warn{color:#f59e0b}</style></head><body><main>${body}</main></body></html>`;
}

/**
 * Human approval step of the OAuth flow. Requires a signed-in admin with `ai:manage`
 * (2FA already completed). The admin chooses which AI agent account the assistant acts as.
 */
/** CSP source for a redirect target: its origin for http(s), or its scheme for app callbacks (e.g. `claude:`). */
function redirectSource(uri: string | undefined): string {
  if (!uri) return "";
  try {
    const u = new URL(uri);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : u.protocol;
  } catch {
    return "";
  }
}

function consentCsp(redirectUri?: string): string {
  const formAction = ["'self'", redirectSource(redirectUri)].filter(Boolean).join(" ");
  return `default-src 'none'; style-src 'unsafe-inline'; form-action ${formAction}; frame-ancestors 'none'`;
}

export function consentRoutes(redis: Redis, sessions: SessionStore, provider: SghOAuthProvider): Router {
  const r = Router();
  r.use(loadSession(sessions));
  r.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    next();
  });

  r.get("/oauth/consent", async (req, res) => {
    const id = String(req.query.req ?? "");
    const raw = /^[\w-]{10,60}$/.test(id) ? await redis.get(pendingKey(id)) : null;
    const pending = raw ? (JSON.parse(raw) as PendingAuthorization) : null;
    // form-action also governs the redirect that follows the form POST, so the client's callback must be allowed
    // here — otherwise the browser blocks the hop back to Claude/ChatGPT after the request was already approved.
    res.setHeader("Content-Security-Policy", consentCsp(pending?.redirectUri));
    if (!raw) return res.status(400).send(page("Link expired", `<h1>This connection request expired</h1><p>Start connecting again from Claude or ChatGPT.</p>`));
    const s = req.session;
    if (!s || s.stage !== "active") return res.redirect(302, `/admin/login?next=${encodeURIComponent(`/oauth/consent?req=${id}`)}`);
    if (s.mustSetup2fa) return res.redirect(302, "/admin/setup-2fa");
    if (!hasPermission(s.permissions, "ai:manage")) return res.status(403).send(page("Not allowed", `<h1>Not allowed</h1><p>Only a Super Admin or Admin can connect AI assistants.</p>`));
    const p = pending!;
    const agents = await AdminModel.find({ kind: "ai_agent", status: "active" }).populate("role", "name").select("name role").lean();
    const host = (() => {
      try {
        return new URL(p.redirectUri).host;
      } catch {
        return "unknown";
      }
    })();
    const options = agents
      .map((a, i) => `<label><input type="radio" name="agentId" value="${a._id}" ${i === 0 ? "checked" : ""} required><span><strong>${esc(a.name)}</strong><br><small>Role: ${esc(String((a.role as unknown as { name?: string })?.name ?? ""))}</small></span></label>`)
      .join("");
    const body = agents.length
      ? `<h1>Connect “${esc(p.clientName)}”?</h1>
<p><strong>${esc(host)}</strong> wants to work with your Shivanshi Gaming Hub content. It will act as the AI agent account you choose — with exactly that account's permissions — and every change is recorded in the audit log.</p>
<form method="post" action="/oauth/consent">
<input type="hidden" name="req" value="${esc(id)}"><input type="hidden" name="csrf" value="${esc(s.csrf)}">
${options}
<div class="row"><button class="primary" type="submit" name="action" value="approve">Allow</button><button type="submit" name="action" value="deny">Deny</button></div>
</form>`
      : `<h1>No AI agent account yet</h1><p class="warn">Create one first in <a href="/admin/ai-agents">Admin → AI agents</a>, then start connecting again.</p>`;
    res.send(page("Connect AI assistant", body));
  });

  r.post("/oauth/consent", express.urlencoded({ extended: false, limit: "10kb" }), async (req, res) => {
    const s = req.session;
    const b = req.body as { req?: string; agentId?: string; csrf?: string; action?: string };
    if (!s || s.stage !== "active" || s.mustSetup2fa || !hasPermission(s.permissions, "ai:manage")) return res.status(403).send(page("Not allowed", "<h1>Not allowed</h1>"));
    if (!b.csrf || !safeEqual(b.csrf, s.csrf)) return res.status(403).send(page("Expired", "<h1>Security token expired</h1><p>Reload the page and try again.</p>"));
    const id = String(b.req ?? "");
    if (b.action === "deny") {
      const url = await provider.deny(id);
      return url ? res.redirect(302, url) : res.status(400).send(page("Expired", "<h1>Request expired</h1>"));
    }
    const agent = b.agentId && /^[a-f\d]{24}$/i.test(b.agentId) ? await AdminModel.findOne({ _id: b.agentId, kind: "ai_agent", status: "active" }).lean() : null;
    if (!agent) return res.status(400).send(page("Choose an agent", "<h1>Choose an AI agent account</h1>"));
    try {
      const raw = await redis.get(pendingKey(id));
      const url = await provider.approve(id, String(agent._id), s.adminId);
      const p = raw ? (JSON.parse(raw) as PendingAuthorization) : null;
      await audit(req, { action: "ai.connect", entityType: "admin", entityId: String(agent._id), summary: `${p?.clientName ?? "AI assistant"} connected as ${agent.name}` });
      // form-action must allow the client's redirect origin for this response
      res.setHeader("Content-Security-Policy", consentCsp(url));
      res.redirect(302, url);
    } catch (err) {
      if (!(err instanceof InvalidGrantError)) logger.error({ err }, "MCP consent approve failed");
      res.status(400).send(page("Expired", "<h1>This connection request expired</h1><p>Start again from Claude or ChatGPT.</p>"));
    }
  });
  return r;
}
