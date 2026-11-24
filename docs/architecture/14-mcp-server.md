# 14 — MCP server for AI assistants

Most content is researched and drafted with Claude and ChatGPT. The backend therefore exposes a **Model Context Protocol (MCP) server**. Assistants work directly in the CMS through it, with no copy-pasting, and every rule the admin panel enforces still applies.

## What an assistant can do
| Tool | Purpose |
|---|---|
| `get_guidelines` | Editorial rules (also sent as server instructions and the `sgh://guidelines` resource) |
| `get_overview` | Dashboard counts, the "needs attention" list, and the agent's own permissions |
| `get_schema` | JSON Schema of a content type, generated from the same Zod schema the API validates with, plus type-specific rules |
| `list_reference_data` | Ids of games, categories, tags, scopes and devices |
| `search_content` / `get_content` | Find items, avoid duplicates, read the full item with its `version` |
| `create_content` / `update_content` | Create drafts / change fields (`If-Match` concurrency via `version`) |
| `get_publish_checks` | Blocking problems and warnings before review |
| `content_action` | Workflow; agents normally use `submit` (draft → review) |
| `get_preview_link` | 30-minute draft-mode preview link to send to the owner |
| `list_media` | Reuse images the team uploaded (agents cannot upload) |
| `get_seo_overview` | Site SEO audit |

Content types: tournament, sensitivity setup, device, gun guide, article, category, tag.

Prompts: `add_tournament`, `write_guide`, `add_sensitivity_setup`.

## Safety model
- **AI agent accounts** are `Admin` documents with `kind: "ai_agent"`, and they are hidden from the Users page. They cannot sign in with a password. They act only through tokens.
- The default **AI agent role** can read, create and update content. It cannot publish, verify, delete, or touch settings, legal pages, users, roles, the audit log or the inbox.
- A **hard permission ceiling** (`agentPermissionFilter`) strips people, roles, settings, legal, audit, cache, AI-management and inbox permissions, plus every `:delete`, from agent sessions, whatever role an agent is given. A human always publishes.
- **Every tool call goes through the real admin API** (an in-process loopback HTTP call with a service session for the agent). Validation, publish checks, ownership rules, revisions, cache revalidation and the **audit log** (actor = the agent) are therefore identical to the admin panel.
- **No personal data reaches the AI:** inbox endpoints (feedback, contact, reports, privacy requests) are not exposed.
- **Tokens:**
  - only SHA-256 hashes are stored
  - personal tokens are shown once and expire after 30, 90 or 365 days (or never)
  - OAuth access tokens last 1 hour
  - refresh tokens last 30 days and **rotate on every use**
  - authorization codes are single-use and PKCE S256 is required
- Pausing or removing an agent, changing its role, or disconnecting an assistant takes effect on the next request.

## Endpoints (Express, mounted at the site root; Nginx routes them to the API)
| Path | |
|---|---|
| `POST /mcp` | Streamable HTTP, stateless, JSON responses, `Authorization: Bearer …` |
| `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server` | OAuth discovery |
| `/register`, `/authorize`, `/token`, `/revoke` | OAuth 2.1 with dynamic client registration |
| `/oauth/consent` | The human approval step. It requires a signed-in admin with `ai:manage` (Super Admin or Admin, so 2FA is done). The admin picks which AI agent account the assistant acts as. |
| `/api/v1/admin/ai-agents…` | Admin → AI agents: create, pause or remove agents; create or revoke tokens; disconnect assistants |

OAuth requires HTTPS. If `SITE_URL` is plain HTTP (for example, a server reached by IP before the domain and TLS are set up), the OAuth endpoints and the consent page are not mounted, and the API logs a warning. Personal access tokens still work.

## Connecting
1. Admin → **AI agents** → New AI agent (e.g. "Claude").
2. Then connect from the assistant you use:
   - **claude.ai / Claude Desktop / mobile:** Settings → Connectors → Add custom connector → `https://shivanshigaming.com/mcp`. Then Connect, sign in, and choose the agent.
   - **ChatGPT:** Settings → Apps & Connectors → Advanced → Developer mode. Create a connector with the same URL and OAuth, then sign in and choose the agent.
   - **Claude Code / scripts:** create an access token on the agent, then run `claude mcp add --transport http sgh https://shivanshigaming.com/mcp --header "Authorization: Bearer sgh_pat_…"`.

## Code
- `backend/src/modules/mcp/`:
  - `oauth.provider.ts`
  - `consent.routes.ts`
  - `admin-client.ts`
  - `mcp.server.ts` (tools, prompts, guidelines)
  - `mcp.routes.ts`
  - `ai-agents.routes.ts`
  - `mcp.models.ts`
- Frontend: `frontend/src/app/admin/(protected)/ai-agents/page.tsx`
- Tests: `backend/tests/mcp.test.ts` covers:
  - personal token → tools → draft with audit, 409 on a stale version, 403 on approve, revoke → 401
  - no password login for agents; suspend → 401
  - the full OAuth flow with consent, PKCE, single-use codes and refresh rotation
  - disconnect

Day-to-day use with Claude (master prompt, task prompts, review routine, legal-page checklist): [../ai-content-playbook.md](../ai-content-playbook.md).
