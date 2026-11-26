# Go-live runbook — shivanshigaming.com

Follow these steps in order. Expect about one day of setup, plus waiting time for AWS SES approval and DNS propagation.
Every secret goes into **AWS SSM Parameter Store**. Never put a secret in GitHub, a chat or a file in the repository.

---

## 0. Accounts you need (owner)
| Account | Plan to start with | Notes |
|---|---|---|
| AWS | pay-as-you-go | Enable MFA on the root user, create an admin IAM user for daily work, and set a billing alarm (e.g. $50) |
| MongoDB Atlas | **M10** (AWS, Mumbai `ap-south-1`) | M10 or higher is needed for continuous backup / point-in-time restore |
| Cloudflare | Free (Pro optional) | Move the domain's nameservers to Cloudflare |
| GitHub | Free (private repo) | Turn on secret scanning and Dependabot |
| Google | Search Console, GA4 (optional) | Bing Webmaster Tools can import from Search Console |

## 1. MongoDB Atlas
1. Create a project called **sgh-prod** and a cluster: **M10, AWS, ap-south-1**, MongoDB 8.
2. Backups: enable **Continuous Cloud Backup**. Suggested retention: 7-day point-in-time restore, 4 weekly and 3 monthly snapshots (confirm with counsel).
3. Database user `sgh_app` gets a custom role with `readWrite` on database `sgh`. To make the audit log append-only, create a custom role that allows `find`/`insert` on `audit_logs` and **does not** allow `update`/`remove`.
4. Network access: allow only the EC2 Elastic IP (from step 3).
5. Copy the `mongodb+srv://…` connection string. It's stored in SSM at step 5.
6. Create a separate **sgh-staging** project. An M0 or M2 cluster is fine for staging.

## 2. AWS — storage, email, roles (region ap-south-1)
1. **S3 buckets:**
   - `media.shivanshigaming.com`: block public ACLs, versioning on, and apply the bucket policy from [`../aws/media-bucket-policy.json`](../aws/media-bucket-policy.json) (Cloudflare IP ranges, `public/` prefix only).
   - `sgh-artifacts-<account>`: private; lifecycle rule to delete `releases/` after 60 days.
   - `sgh-backups-<account>`: private, versioning on, SSE-KMS encryption, lifecycle rule to Glacier after 30 days.
2. **SES:**
   - Verify the domain `shivanshigaming.com`, add the DKIM CNAME records in Cloudflare, and add a DMARC record (`v=DMARC1; p=quarantine; rua=mailto:<contact>`).
   - **Request production access.** Until it's approved, SES can only send to verified addresses.
   - Create SMTP credentials.
3. **IAM:**
   - Instance role `sgh-ec2`: policy [`../aws/ec2-instance-role-policy.json`](../aws/ec2-instance-role-policy.json), plus `AmazonSSMManagedInstanceCore`.
   - GitHub OIDC provider and role `sgh-github-deploy`: trust policy [`../aws/github-oidc-trust-policy.json`](../aws/github-oidc-trust-policy.json), permissions [`../aws/github-deploy-role-policy.json`](../aws/github-deploy-role-policy.json).

## 3. AWS — server
1. Launch EC2: **t4g.medium** (ARM, 4 GB), Ubuntu 24.04, 30 GB gp3 (encrypted), instance role `sgh-ec2`, in a public subnet.
2. Allocate and attach an **Elastic IP**.
3. Security group:
   - **inbound 443 only from Cloudflare IP ranges**
   - **no SSH**: use SSM Session Manager
   - outbound: all
4. Connect with Session Manager, copy the `infrastructure/` folder onto the server, and run `sudo bash infrastructure/scripts/server-setup.sh`. Store the Redis password in SSM first (step 5).

## 4. Cloudflare
1. DNS records, all **proxied (orange cloud)**:
   - `A @` → the Elastic IP
   - `CNAME www` → `shivanshigaming.com`
   - `CNAME media` → `media.shivanshigaming.com.s3.ap-south-1.amazonaws.com`
   - `A staging` → the staging IP, protected with Cloudflare Access
2. SSL/TLS:
   - mode **Full (strict)**
   - turn on **Always Use HTTPS**, **Automatic HTTPS Rewrites**, minimum TLS 1.2 and **Authenticated Origin Pulls**
   - create an **Origin Certificate** (15 years) and install it on the server under `/etc/ssl/cloudflare/`
3. HSTS: enable it (6 months to start, then 1 year with preload once everything is stable).
4. Cache rules:
   - bypass cache for `/admin*` and `/api/v1/admin*`
   - cache everything for `/_next/static/*` and `media.*`
   - respect origin headers for everything else
5. Security:
   - WAF managed rules on
   - Bot Fight Mode on
   - rate-limiting rule on `/api/v1/admin/auth/login` (for example 10 requests per minute per IP)
   - optionally a **Cloudflare Access** policy (email one-time PIN) on `/admin*` as a second lock (do **not** put Access on `/mcp`, `/token`, `/register`, `/authorize`, `/.well-known/oauth-*` — Claude and ChatGPT servers call them)
   - a WAF **custom rule → Skip** (Bot Fight Mode / Super Bot Fight Mode, managed challenge) for `/mcp`, `/token`, `/register`, `/revoke` and `/.well-known/oauth-*`; otherwise AI assistants' servers get a challenge page instead of the API
6. **Turnstile:** create a widget for `shivanshigaming.com` and keep the site key and secret for step 5.
7. Create an API token scoped to **Zone → Cache Purge** for this zone only, for GitHub.

## 5. Secrets — SSM Parameter Store (SecureString)
Create one parameter per variable under the paths `/sgh/prod/backend/<NAME>` and `/sgh/prod/frontend/<NAME>`. The variable lists are in [`../env/backend.env.example`](../env/backend.env.example) and [`../env/frontend.env.example`](../env/frontend.env.example).

- Generate the random values with `openssl rand -base64 48`. `ENCRYPTION_KEY` must use `openssl rand -base64 32`.
- `REVALIDATE_SECRET` and `INDEXNOW_KEY` must be **identical** in backend and frontend.
- Also create `/sgh/prod/redis/password`.
- Do the same under `/sgh/staging/...` for staging.

## 6. GitHub
1. Push the repository and protect `main` (pull requests and passing CI required).
2. Create two **environments**: `staging` and `production`. Production needs a required reviewer, which is you.
3. Add these values to each environment:
   - **Variables:** `SITE_ENV`, `SGH_ENV`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MEDIA_ORIGIN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `ARTIFACT_BUCKET`, `EC2_INSTANCE_ID`, `CLOUDFLARE_ZONE_ID`
   - **Secrets:** `AWS_DEPLOY_ROLE_ARN`, `CLOUDFLARE_PURGE_TOKEN`
4. Merging to `main` deploys staging. Tagging `v1.0.0` deploys production after your approval.

## 7. First production deploy
1. Tag `v1.0.0` and approve the deployment in GitHub → Actions.
2. Create the first admin through Session Manager. A temporary password is printed once:
   `sudo -iu sgh bash -c 'cd /srv/sgh/current/backend && node --env-file=/srv/sgh/shared/backend.env dist/create-super-admin.js --email <your-email> --name "Shivanshi Tripathi"'`
3. Open `https://shivanshigaming.com/admin`, sign in, set up 2FA and **save the recovery codes offline**. Then change the password under My account.
4. Under Admin → Settings, fill in:
   - Grievance Officer **postal address**
   - court **jurisdiction city**
   - **retention periods** (agreed with counsel)
   - GA4 ID and Search Console / Bing verification tokens, if you use them
5. Admin → Legal pages: after counsel review, edit the drafts, tick **Reviewed by counsel**, set the effective date and publish all 10. Production blocks publishing until every placeholder is filled.
6. Optional — AI assistants: Admin → **AI agents** → New AI agent, then connect Claude/ChatGPT (instructions on that page; details in `docs/architecture/14-mcp-server.md`). Everything they create arrives as drafts for you to review.
7. Add real content: tested sensitivity setups, devices, gun guides, tournaments with official announcement links, and articles.

## 7b. Play features (custom rooms, daily spin, rewards)
1. **Google sign-in key.**
   - Google Cloud Console → APIs & Services → **OAuth consent screen**: External, app name "Shivanshi Gaming Hub", support email, link to the Privacy Policy, scopes `openid email profile` only. Publish the app.
   - Then **Credentials → Create credentials → OAuth client ID → Web application**.
     - Authorised JavaScript origins: `https://shivanshigaming.com`.
     - No redirect URIs are needed.
   - Put the client ID into **both** `GOOGLE_CLIENT_ID` (backend) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend), then rebuild the frontend.
2. **Legal.** Have counsel review the *Custom Room Rules*, *SGC Rewards Terms* and the updated *Privacy Policy* and *Terms*, then publish them. Players accept them when they sign up.
3. **Rewards.**
   - Only list vouchers you have bought from authorised partners.
   - Set the stock to the number of codes you hold.
   - Check the spin and streak numbers in Admin → Rewards store before launch.
4. **Optional.** Email KRAFTON India Esports about running community custom rooms with prizes.

## 8. Search engines
1. **Search Console:** add a Domain property and verify it with the DNS TXT record in Cloudflare. Submit `https://shivanshigaming.com/sitemap.xml`.
2. **Bing Webmaster Tools:** import from Search Console.
3. **IndexNow** is automatic when `INDEXNOW_KEY` is set. Published changes ping Bing and Yandex.

## 9. Monitoring and alerts
1. Install the **CloudWatch agent** to collect CPU, memory and disk, plus PM2 logs from `/home/sgh/.pm2/logs`.
2. Alarms (email via SNS):
   - CPU above 80% for 10 minutes
   - memory above 85%
   - disk above 80%
   - status-check failure
3. Set up an **uptime check** on `https://shivanshigaming.com/api/v1/health` and `/` every minute. Cloudflare Health Checks or UptimeRobot both work.
4. Enable Atlas alerts for connections, slow queries, disk and replication lag.
5. Daily, glance at Admin → Dashboard "Needs attention": overdue reports, stale tournament verifications, pending codes.

## 10. Backups — verify, don't assume
- Atlas continuous backup is the primary backup.
- Add the nightly cron for [`../scripts/backup-config.sh`](../scripts/backup-config.sh) (settings, legal versions, redirects, roles to S3).
- S3 media is versioned.
- **Monthly restore drill:** restore the latest Atlas snapshot into the staging project, point staging at it and check that the site works. Write the date in [`operations.md`](operations.md).

## 11. Final go-live checklist
- [ ] Legal pages reviewed by counsel and published, with no placeholders left
- [ ] Grievance Officer details complete, and the email inbox is monitored daily
- [ ] SES production access approved; a test report email received
- [ ] Turnstile keys set, and the forms work
- [ ] At least a few **real** published setups and tournaments (empty sections hide themselves, but launch with content)
- [ ] Search Console verified and sitemap submitted
- [ ] `https://shivanshigaming.com/robots.txt` allows crawling, and staging still shows `Disallow: /`
- [ ] Uptime checks and alarms receiving test notifications
- [ ] Admin 2FA recovery codes stored offline
- [ ] One rollback tested on staging (`rollback.sh`)
