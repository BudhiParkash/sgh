# Operations guide

## Everyday commands (through AWS Session Manager, as `sgh`)
| Task | Command |
|---|---|
| Status of all processes | `pm2 status` |
| Live logs | `pm2 logs sgh-api` · `pm2 logs sgh-web` · `pm2 logs sgh-worker` |
| Restart one service | `pm2 reload sgh-api` (zero downtime in cluster mode) |
| Deploy a specific build | `bash /srv/sgh/current/infrastructure/scripts/deploy.sh <git-sha>` (normally done by GitHub Actions) |
| Roll back to the previous release | `bash /srv/sgh/current/infrastructure/scripts/rollback.sh` |
| Roll back to a specific release | `bash /srv/sgh/current/infrastructure/scripts/rollback.sh <git-sha>` · releases are listed in `/srv/sgh/releases` |
| Health | `curl -s 127.0.0.1:4000/api/v1/health` |

## Admin access problems
- **Locked out after too many attempts:** another Super Admin uses Users → Unlock. If you are the only Super Admin, the lock lifts automatically after 15 minutes, then 1 hour; after 15 failures it needs a database fix: `db.admins.updateOne({email:"…"},{$set:{failedLoginCount:0},$unset:{lockedUntil:1}})`.
- **Lost phone (2FA):** sign in with one of the 10 recovery codes, then set up 2FA again. Another Super Admin can also use Users → Reset 2FA.
- **Force sign-out of a compromised account:** Users → Force sign-out, then reset the password.

## AI assistants (MCP)
- **Review AI drafts:** filter any content list by status *review*. The audit log shows the agent's name as the actor.
- **A token leaked or a laptop was lost:** Admin → AI agents → Revoke the token (or Pause the agent: every connection stops immediately).
- **Disconnect claude.ai / ChatGPT:** Admin → AI agents → Connected assistants → Disconnect.
- **Assistant says "challenge" / 403 from Cloudflare:** check the WAF skip rule for `/mcp` and the OAuth paths (go-live §4.5).

## Content safety
- **Wrong tournament info reported:** fix it, Record verification, save. The site updates immediately.
- **Copyright or privacy report:** the Reports inbox shows the 24-hour acknowledgement and 15-day resolution deadlines. The reporter is emailed when you resolve it.
- **Privacy request:** act only on *verified* requests. Use Export (JSON) to answer access requests and Erase for erasure requests.

## Incidents
1. **Site down:** check `pm2 status` first, then `pm2 logs`, then the Atlas status page, then Cloudflare.
2. **A bad deploy:** run `rollback.sh`. Database changes are always backward compatible, so rollback is safe.
3. **Suspected breach:** rotate the secrets in SSM (session secret, `HASH_SECRET`, DB password, Turnstile, purge token) and redeploy. Every admin is signed out when `HASH_SECRET`/`ENCRYPTION_KEY` change or sessions are flushed (`redis-cli -a … FLUSHDB` on the session DB). Check the audit log, and notify the Data Protection Board and affected users within the timelines the law requires; legal counsel decides.

## Restore drill log
| Date | Snapshot restored | Result | By |
|---|---|---|---|
| | | | |
