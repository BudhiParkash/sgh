/* eslint-disable @typescript-eslint/no-explicit-any -- JSON tool results */
import { createHash, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { hashPassword } from "../src/lib/password.js";
import { AdminModel } from "../src/modules/admins/admin.model.js";
import { RoleModel } from "../src/modules/admins/role.model.js";
import { agentPermissionFilter } from "../src/modules/admins/permissions.js";
import { AuditLogModel } from "../src/modules/audit/audit.model.js";
import { GameModel } from "../src/modules/games/game.model.js";
import { seedReferenceData } from "../src/modules/seed.js";
import { TournamentModel } from "../src/modules/tournaments/tournament.model.js";
import sharp from "sharp";
import { isPublicAddress } from "../src/modules/mcp/fetch-image.js";
import { createAdmin, freshIp, makeApp, signInWith2fa, type Agent } from "./helpers.js";

const app = makeApp();
let server: Server;
let base: string;
beforeAll(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const AI = "/api/v1/admin/ai-agents";
const send = (a: Agent, method: "get" | "post" | "patch" | "delete", path: string) => a.agent[method](AI + path).set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf);

async function setup() {
  await seedReferenceData();
  await createAdmin("super_admin", "owner@test.local");
  const owner = await signInWith2fa(app, "owner@test.local");
  const agent = await send(owner, "post", "").send({ name: "Claude" });
  expect(agent.status).toBe(201);
  return { owner, agentId: agent.body.data.id as string };
}

async function connect(token: string) {
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return client;
}
const textOf = (r: any) => (r.content as { text: string }[]).map((c) => c.text).join("\n");

describe("AI agents & MCP", () => {
  it("permission ceiling strips people, settings, inbox and delete permissions", () => {
    expect(["tournament:create", "article:update", "seo:read"].every(agentPermissionFilter)).toBe(true);
    expect(["admin:create", "role:update", "settings:update", "legal:publish", "report:read", "privacy_request:read", "tournament:delete", "ai:manage"].some(agentPermissionFilter)).toBe(false);
  });

  it("personal token → MCP tools create drafts through the admin API; publishing is refused; revoked tokens stop working", async () => {
    const { owner, agentId } = await setup();
    const tok = await send(owner, "post", `/${agentId}/tokens`).send({ name: "Claude Code", expiresInDays: 30 });
    expect(tok.status).toBe(201);
    const pat = tok.body.data.token as string;
    expect(pat).toMatch(/^sgh_pat_/);

    // Without a token: 401 pointing at the protected-resource metadata (how hosts discover OAuth).
    const anon = await request(app).post("/mcp").send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(anon.status).toBe(401);
    expect(anon.headers["www-authenticate"]).toContain("/.well-known/oauth-protected-resource/mcp");

    const client = await connect(pat);
    expect(client.getInstructions()).toMatch(/Never invent facts/);
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(["get_guidelines", "get_schema", "list_reference_data", "search_content", "create_content", "update_content", "content_action", "get_preview_link"]));

    const schema = JSON.parse(textOf(await client.callTool({ name: "get_schema", arguments: { type: "tournament" } })));
    expect(schema.schema.required).toEqual(expect.arrayContaining(["name", "game", "organiser", "officialSourceUrl"]));
    expect(schema.schema.properties.startDate.anyOf[0]).toMatchObject({ type: "string", format: "date-time" });

    const games = JSON.parse(textOf(await client.callTool({ name: "list_reference_data", arguments: { kind: "games" } })));
    const bgmi = games.find((g: any) => g.key === "bgmi");
    expect(bgmi.id).toBe(String((await GameModel.findOne({ key: "bgmi" }))!._id));

    // Validation errors come back as tool errors the model can act on.
    const bad = await client.callTool({ name: "create_content", arguments: { type: "tournament", data: { name: "X" } } });
    expect(bad.isError).toBe(true);
    expect(textOf(bad)).toMatch(/Error 400/);

    const made = await client.callTool({
      name: "create_content",
      arguments: {
        type: "tournament",
        data: { name: "Example Community Cup", game: bgmi.id, organiser: "Example Esports", officialSourceUrl: "https://example.com/cup", sources: [{ url: "https://example.com/cup", type: "official", title: "Official announcement" }] },
      },
    });
    expect(made.isError).toBeFalsy();
    const id = JSON.parse(textOf(made)).created.id as string;
    const doc = await TournamentModel.findById(id).lean();
    expect(doc!.workflow!.status).toBe("draft");
    expect(String(doc!.createdBy)).toBe(agentId);
    expect(await AuditLogModel.countDocuments({ action: "tournament.create", actor: agentId })).toBe(1);

    const upd = await client.callTool({ name: "update_content", arguments: { type: "tournament", id, data: { organiser: "Example Esports India" }, version: 0 } });
    expect(upd.isError).toBeFalsy();
    const stale = await client.callTool({ name: "update_content", arguments: { type: "tournament", id, data: { organiser: "Again" }, version: 0 } });
    expect(textOf(stale)).toMatch(/Error 409/);

    expect((await client.callTool({ name: "content_action", arguments: { type: "tournament", id, action: "submit", note: "Dates not announced yet" } })).isError).toBeFalsy();
    const pub = await client.callTool({ name: "content_action", arguments: { type: "tournament", id, action: "approve" } });
    expect(pub.isError).toBe(true);
    expect(textOf(pub)).toMatch(/Error 403/);
    expect((await TournamentModel.findById(id).lean())!.workflow!.status).toBe("review");

    const preview = JSON.parse(textOf(await client.callTool({ name: "get_preview_link", arguments: { type: "tournament", id } })));
    expect(preview.url).toMatch(/^http:\/\/localhost:3000\/api\/preview\?token=.+&path=%2Ftournaments%2Fexample-community-cup$/);
    await client.close();

    // Token list + revoke
    const list = await send(owner, "get", "");
    expect(list.body.data[0].tokens[0]).toMatchObject({ name: "Claude Code", prefix: pat.slice(0, 14) });
    expect(list.body.data[0].effectivePermissions).not.toContain("tournament:publish");
    await send(owner, "delete", `/${agentId}/tokens/${list.body.data[0].tokens[0].id}`).expect(204);
    const after = await request(app).post("/mcp").set("Authorization", `Bearer ${pat}`).set("Accept", "application/json, text/event-stream").send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(after.status).toBe(401);
  });

  it("'AI agent (publisher)' role lets the agent approve and archive (never delete)", async () => {
    const { owner, agentId } = await setup();
    const role = await RoleModel.findOne({ key: "ai_publisher" }).lean();
    expect(role).toBeTruthy();
    await send(owner, "patch", `/${agentId}`).send({ role: String(role!._id) }).expect(200);
    const pat = (await send(owner, "post", `/${agentId}/tokens`).send({ name: "Claude", expiresInDays: 30 })).body.data.token as string;
    const client = await connect(pat);
    const bgmi = (await GameModel.findOne({ key: "bgmi" }))!;
    const create = async (name: string) =>
      JSON.parse(textOf(await client.callTool({ name: "create_content", arguments: { type: "tournament", data: { name, game: String(bgmi._id), organiser: "Example", officialSourceUrl: "https://example.com/x" } } }))).created.id as string;

    const a = await create("Publisher Cup A");
    expect((await client.callTool({ name: "content_action", arguments: { type: "tournament", id: a, action: "submit" } })).isError).toBeFalsy();
    expect((await client.callTool({ name: "content_action", arguments: { type: "tournament", id: a, action: "approve" } })).isError).toBeFalsy();
    expect((await TournamentModel.findById(a).lean())!.workflow!.status).toBe("approved");

    const dup = await create("Publisher Cup Duplicate");
    expect((await client.callTool({ name: "content_action", arguments: { type: "tournament", id: dup, action: "archive", note: "Duplicate" } })).isError).toBeFalsy();
    expect((await TournamentModel.findById(dup).lean())!.workflow!.status).toBe("archived");

    const list = await send(owner, "get", "");
    expect(list.body.data[0].effectivePermissions).toEqual(expect.arrayContaining(["tournament:publish", "article:publish", "article:update_any"]));
    expect(list.body.data[0].effectivePermissions).not.toContain("tournament:delete");
    expect(list.body.data[0].effectivePermissions).not.toContain("tournament:verify");
    await client.close();
  });

  it("AI agent accounts can't sign in with a password and are hidden from Users; suspending blocks tokens", async () => {
    const { owner, agentId } = await setup();
    await AdminModel.updateOne({ _id: agentId }, { passwordHash: await hashPassword("Correct-Horse-Battery-42") });
    const agent = await AdminModel.findById(agentId).lean();
    const login = await request(app).post("/api/v1/admin/auth/login").set("X-Forwarded-For", freshIp()).send({ email: agent!.email, password: "Correct-Horse-Battery-42" });
    expect(login.status).toBe(401);
    const users = await owner.agent.get("/api/v1/admin/admins").set("X-Forwarded-For", owner.ip);
    expect(users.body.data.map((u: any) => u.id)).not.toContain(agentId);

    const pat = (await send(owner, "post", `/${agentId}/tokens`).send({ name: "CLI" })).body.data.token as string;
    await send(owner, "patch", `/${agentId}`).send({ status: "suspended" }).expect(200);
    const r = await request(app).post("/mcp").set("Authorization", `Bearer ${pat}`).set("Accept", "application/json, text/event-stream").send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(r.status).toBe(401);
  });

  it("OAuth: discovery → registration → consent by an admin → PKCE code exchange → MCP; refresh tokens rotate", async () => {
    const { owner, agentId } = await setup();
    const meta = await request(app).get("/.well-known/oauth-authorization-server").expect(200);
    expect(meta.body).toMatchObject({ issuer: "http://localhost:3000/", code_challenge_methods_supported: ["S256"] });
    const prm = await request(app).get("/.well-known/oauth-protected-resource/mcp").expect(200);
    expect(prm.body.resource).toBe("http://localhost:3000/mcp");

    const redirectUri = "http://localhost:9999/callback";
    const reg = await request(app).post("/register").send({ client_name: "Claude", redirect_uris: [redirectUri], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] });
    expect(reg.status).toBe(201);
    const clientId = reg.body.client_id as string;

    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const auth = await request(app).get("/authorize").query({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: "S256", state: "xyz", scope: "mcp" });
    expect(auth.status).toBe(302);
    const consentUrl = auth.headers.location as string;
    expect(consentUrl).toMatch(/^\/oauth\/consent\?req=/);

    // Not signed in → sent to the admin login, which returns here afterwards.
    const anonConsent = await request(app).get(consentUrl);
    expect(anonConsent.status).toBe(302);
    expect(anonConsent.headers.location).toMatch(/^\/admin\/login\?next=%2Foauth%2Fconsent/);

    const page = await owner.agent.get(consentUrl).set("X-Forwarded-For", owner.ip);
    expect(page.status).toBe(200);
    expect(page.text).toContain("Connect “Claude”?");
    expect(page.text).toContain(`value="${agentId}"`);
    // form-action must allow the client's callback, or browsers block the redirect that follows "Allow".
    expect(page.headers["content-security-policy"]).toContain("form-action 'self' http://localhost:9999;");
    const csrf = /name="csrf" value="([^"]+)"/.exec(page.text)![1]!;
    const reqId = new URL(consentUrl, "http://x").searchParams.get("req")!;

    // Wrong CSRF token is rejected.
    await owner.agent.post("/oauth/consent").set("X-Forwarded-For", owner.ip).type("form").send({ req: reqId, csrf: "nope", agentId, action: "approve" }).expect(403);
    const approve = await owner.agent.post("/oauth/consent").set("X-Forwarded-For", owner.ip).type("form").send({ req: reqId, csrf, agentId, action: "approve" });
    expect(approve.status).toBe(302);
    const cb = new URL(approve.headers.location as string);
    expect(cb.origin + cb.pathname).toBe(redirectUri);
    expect(cb.searchParams.get("state")).toBe("xyz");
    const code = cb.searchParams.get("code")!;

    const badPkce = await request(app).post("/token").type("form").send({ grant_type: "authorization_code", client_id: clientId, code, code_verifier: "wrong-verifier-wrong-verifier-wrong-verifier", redirect_uri: redirectUri });
    expect(badPkce.status).toBe(400);
    const tokens = await request(app).post("/token").type("form").send({ grant_type: "authorization_code", client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri });
    expect(tokens.status).toBe(200);
    expect(tokens.body).toMatchObject({ token_type: "bearer", expires_in: 3600 });
    // Codes are single-use.
    expect((await request(app).post("/token").type("form").send({ grant_type: "authorization_code", client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri })).status).toBe(400);

    const client = await connect(tokens.body.access_token);
    const overview = JSON.parse(textOf(await client.callTool({ name: "get_overview", arguments: {} })));
    expect(overview.myPermissions).toContain("tournament:create");
    await client.close();

    const r1 = await request(app).post("/token").type("form").send({ grant_type: "refresh_token", client_id: clientId, refresh_token: tokens.body.refresh_token });
    expect(r1.status).toBe(200);
    const reuse = await request(app).post("/token").type("form").send({ grant_type: "refresh_token", client_id: clientId, refresh_token: tokens.body.refresh_token });
    expect(reuse.status).toBe(400);

    // The connection shows in Admin → AI agents and can be disconnected.
    const list = await send(owner, "get", "");
    expect(list.body.data[0].connections[0]).toMatchObject({ clientId, clientName: "Claude" });
    await send(owner, "delete", `/${agentId}/connections/${clientId}`).expect(204);
    const gone = await request(app).post("/mcp").set("Authorization", `Bearer ${r1.body.access_token}`).set("Accept", "application/json, text/event-stream").send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(gone.status).toBe(401);
  });
  it("upload_media: base64 upload goes through the media pipeline and audit log; unsafe URLs are refused", async () => {
    const { owner, agentId } = await setup();
    const pat = (await send(owner, "post", `/${agentId}/tokens`).send({ name: "Claude", expiresInDays: 30 })).body.data.token as string;
    const client = await connect(pat);
    const call = async (args: Record<string, unknown>) => client.callTool({ name: "upload_media", arguments: args });
    const png = await sharp({ create: { width: 320, height: 180, channels: 3, background: { r: 20, g: 120, b: 200 } } }).png().toBuffer();
    const meta = { alt: "Blue banner for the recoil guide", licence: "original", licenceNotes: "Generated by Claude for this article", category: "article" };

    const up = await call({ ...meta, base64: `data:image/png;base64,${png.toString("base64")}`, filename: "recoil.png" });
    expect(up.isError, textOf(up)).toBeFalsy();
    const media = JSON.parse(textOf(up));
    expect(media).toMatchObject({ width: 320, height: 180, alt: meta.alt });
    expect(media.url).toMatch(/\/media\/.+\.webp$/);
    expect(await AuditLogModel.countDocuments({ action: "media.upload", actor: agentId })).toBe(1);

    const listed = JSON.parse(textOf(await client.callTool({ name: "list_media", arguments: {} })));
    expect(listed[0], JSON.stringify(listed)).toMatchObject({ id: media.id, url: media.url, licence: "original" });

    // Same bytes again → duplicate refused by the library.
    expect((await call({ ...meta, base64: png.toString("base64") })).isError).toBe(true);
    // Input rules.
    expect(textOf(await call({ ...meta }))).toMatch(/exactly one of url or base64/);
    expect(textOf(await call({ ...meta, licence: "press_kit", base64: png.toString("base64") }))).toMatch(/credit is required/);
    expect(textOf(await call({ ...meta, base64: "not base64!" }))).toMatch(/not valid base64/);
    expect((await call({ ...meta, licence: "user_submitted", base64: png.toString("base64") })).isError).toBe(true);
    // SSRF: http, loopback, private and metadata addresses never get fetched.
    expect(textOf(await call({ ...meta, url: "http://example.com/a.png" }))).toMatch(/Only https/);
    for (const url of ["https://127.0.0.1/a.png", "https://localhost/a.png", "https://169.254.169.254/latest/meta-data", "https://[::1]/a.png", "https://10.0.0.5/a.png"]) {
      expect(textOf(await call({ ...meta, url }))).toMatch(/not a public website/);
    }
    expect(["8.8.8.8", "2606:4700::1111"].every(isPublicAddress)).toBe(true);
    expect(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"].some(isPublicAddress)).toBe(false);
    await client.close();
  });
});
