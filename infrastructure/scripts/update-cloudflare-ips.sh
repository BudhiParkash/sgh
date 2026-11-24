#!/usr/bin/env bash
# Regenerates Nginx allow-list + real-IP config from Cloudflare's published ranges.
# Cron (root): 0 4 * * 1 /srv/sgh/current/infrastructure/scripts/update-cloudflare-ips.sh
set -euo pipefail
V4="$(curl -fsS https://www.cloudflare.com/ips-v4)"
V6="$(curl -fsS https://www.cloudflare.com/ips-v6)"
[[ -n "$V4" && -n "$V6" ]] || { echo "Could not fetch Cloudflare IPs" >&2; exit 1; }
{ for ip in $V4 $V6; do echo "set_real_ip_from $ip;"; done; } > /etc/nginx/cloudflare-realip.conf
{ for ip in $V4 $V6; do echo "allow $ip;"; done; echo "deny all;"; } > /etc/nginx/cloudflare-allow.conf
nginx -t && systemctl reload nginx
