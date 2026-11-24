# 11 — AWS Deployment Architecture

## 1. Launch topology (cost-conscious, single region `ap-south-1`)

```
Cloudflare (DNS, proxy, WAF, cache, Access)
   │  A  <domain>          → EC2 Elastic IP (proxied)
   │  A  staging.<domain>  → staging EC2 / same box different port (proxied + Access)
   │  CNAME media.<domain> → media.<domain>.s3.ap-south-1.amazonaws.com (proxied)
   ▼
VPC (ap-south-1) ── public subnet ── EC2 (Ubuntu 24.04 LTS, t4g.medium ARM64 / 4 GB to start)
                                      ├─ Nginx :443 (CF origin cert)
                                      ├─ PM2: sgh-web   (next start, 2 instances, :3000)
                                      ├─ PM2: sgh-api   (cluster mode, 2 instances, :4000)
                                      ├─ PM2: sgh-worker (1 instance, BullMQ)
                                      └─ Redis 7 (local, AOF on)  ← move to ElastiCache when scaling out
                 S3: media.<domain> (versioned, private, Cloudflare-IP-restricted public/ prefix)
                 S3: sgh-backups-<acct> (logs, build artifacts for rollback)
                 SSM Parameter Store (secrets) · CloudWatch (logs, alarms) · IAM instance role
MongoDB Atlas (ap-south-1, AWS) — M10 dedicated in production (backups + PITR), M0/M2 for dev
Email — Amazon SES (ap-south-1) for admin invites, password resets, report acknowledgements
```

Why one EC2 to start: the traffic profile (mostly cacheable reads served by Cloudflare) doesn't justify ALB plus multiple instances on day one, which would cost about 3× as much. The architecture is **stateless at the app tier** (sessions in Redis, files in S3), so scaling out is a configuration change:

**Scale path:** Redis → ElastiCache; Next and API → 2+ instances behind an ALB (or split web/api instances); Next's shared ISR cache → a custom `cacheHandler` on Redis so revalidation is consistent across instances; worker on its own instance.

## 2. Nginx (outline)
```nginx
server {
  listen 443 ssl http2;  server_name <domain>;
  ssl_certificate /etc/ssl/cf-origin.pem; ssl_certificate_key /etc/ssl/cf-origin.key;
  # only Cloudflare may connect (also enforced by security group)
  include /etc/nginx/cloudflare-realip.conf;     # set_real_ip_from … ; real_ip_header CF-Connecting-IP;
  client_max_body_size 100k;
  location /api/v1/admin/media/upload { client_max_body_size 10m; proxy_pass http://api; }
  location /api/ { proxy_pass http://api; proxy_set_header X-Request-Id $request_id; }
  location /_next/static/ { proxy_pass http://web; expires 1y; add_header Cache-Control "public, immutable"; }
  location / { proxy_pass http://web; }
}
upstream web { server 127.0.0.1:3000; keepalive 32; }
upstream api { server 127.0.0.1:4000; keepalive 32; }
```

## 3. CI/CD (GitHub Actions)

```
PR → ci.yml: install (frozen) → lint → typecheck → unit + integration tests (mongodb-memory-server, redis service)
            → build all → Playwright smoke (against built app + seeded test DB) → Lighthouse CI (budgets) → ZAP baseline (nightly)
main merge → deploy-staging.yml: build ARM64 artifacts → upload tarball to S3 (sha-tagged)
            → SSM Run Command on staging: deploy.sh <sha> → health check → Playwright smoke vs staging
release tag vX.Y.Z → deploy-prod.yml (manual approval environment) → same artifact sha → deploy.sh → health checks → Cloudflare purge (HTML only)
```

`deploy.sh <sha>` (idempotent):
1. Download the artifact to `/srv/sgh/releases/<sha>`; `pnpm install --prod --frozen-lockfile`.
2. Pull secrets from SSM into `/srv/sgh/shared/.env.*` (0600).
3. Run DB migrations (`migrate-mongo` style, forward-only and backward-compatible).
4. Switch the symlink `/srv/sgh/current → releases/<sha>`; `pm2 reload ecosystem.config.cjs --update-env` (zero-downtime for the cluster-mode API; Next runs 2 instances reloaded sequentially).
5. Health check `/api/v1/health` and `/`; on failure → automatic `rollback.sh`.
6. Keep the last 5 releases.

`rollback.sh`: point the symlink to the previous release → `pm2 reload` → health check. DB migrations are written to be backward-compatible (expand → migrate → contract across two releases), so code rollback is always safe.

## 4. Operations
- **PM2**: `pm2 startup systemd`, `pm2 save`, `pm2-logrotate` (or logs to stdout → CloudWatch agent).
- **Monitoring**: CloudWatch agent (CPU, memory, disk), alarms → email/SNS: CPU > 80% for 10 min, memory > 85%, disk > 80%, 5xx rate (from Nginx logs metric filter), health-check failure. Sentry for application errors. Atlas alerts for connections, slow queries and replication lag.
- **Backups**: Atlas PITR; S3 versioning; nightly export of `website_settings`, `legal_pages` and `redirects` to the backup bucket as JSON (cheap insurance); quarterly restore drill.
- **SSL**: Cloudflare edge certs (auto) + a 15-year Cloudflare Origin Certificate on Nginx; Full (strict).
- **DNS**: Cloudflare; CAA records; SPF/DKIM/DMARC for SES on the sending domain.
- **Patching**: unattended-upgrades for security patches; monthly AMI/OS review; Node LTS kept current.

## 5. Indicative monthly cost (USD, to validate with the AWS calculator at purchase time)
| Item | Est. |
|---|---|
| EC2 t4g.medium (on-demand; ~40% less with a 1-yr savings plan) + 30 GB gp3 + EIP | ~$30–35 |
| MongoDB Atlas M10 (ap-south-1) | ~$60–70 |
| S3 + requests (low, mostly CF-cached) | <$5 |
| SES, CloudWatch, SSM | <$10 |
| Cloudflare | Free plan workable; Pro (~$20–25) for better WAF rules/image tools |
| Staging (t4g.small + Atlas M0/M2) | ~$15–25 |
| **Total** | **≈ $120–160 / month** at launch |
