import { z } from "zod";
import { doc } from "../../docs/openapi.js";
import { changePasswordSchema, disable2faSchema, loginSchema, totpCodeSchema } from "./auth.schemas.js";

doc("post", "/admin/auth/login", { tag: "Admin auth", summary: "Sign in (password step)", body: loginSchema, response: z.object({ requires2fa: z.boolean(), mustSetup2fa: z.boolean().optional(), csrfToken: z.string().optional() }) });
doc("post", "/admin/auth/2fa/verify", { tag: "Admin auth", summary: "Second step: TOTP or recovery code", body: totpCodeSchema });
doc("post", "/admin/auth/logout", { tag: "Admin auth", summary: "Sign out this session", status: 204 });
doc("post", "/admin/auth/logout-all", { tag: "Admin auth", summary: "Sign out all sessions", auth: true, status: 204 });
doc("get", "/admin/auth/me", { tag: "Admin auth", summary: "Current admin, permissions and CSRF token", auth: true });
doc("post", "/admin/auth/2fa/setup", { tag: "Admin auth", summary: "Begin TOTP enrolment (QR code)", auth: true });
doc("post", "/admin/auth/2fa/enable", { tag: "Admin auth", summary: "Confirm TOTP and get recovery codes", body: totpCodeSchema, auth: true });
doc("post", "/admin/auth/2fa/disable", { tag: "Admin auth", summary: "Disable TOTP (roles without mandatory 2FA)", body: disable2faSchema, auth: true, status: 204 });
doc("post", "/admin/auth/password", { tag: "Admin auth", summary: "Change password (signs out other sessions)", body: changePasswordSchema, auth: true, status: 204 });
doc("get", "/health", { tag: "System", summary: "Health check", response: z.object({ status: z.enum(["ok", "degraded"]), version: z.string() }) });
