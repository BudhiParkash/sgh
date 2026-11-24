#!/usr/bin/env bash
# Regenerates the Nginx real-IP config and the Cloudflare allow-list from Cloudflare's published ranges.
# Cron (root): 0 4 * * 1 /srv/sgh/current/infrastructure/scripts/update-cloudflare-ips.sh
#   cloudflare-realip.conf  set_real_ip_from <range>;   (server/http context)
#   cloudflare-geo.conf     <range> 1;                  (included inside a `geo $realip_remote_addr …` block)
# The allow-list must test $realip_remote_addr (the connecting Cloudflare edge), NOT $remote_addr: the realip
# module has already replaced $remote_addr with the visitor's IP, so a plain allow/deny would block everyone.
set -euo pipefail
V4="$(curl -fsS https://www.cloudflare.com/ips-v4)"
V6="$(curl -fsS https://www.cloudflare.com/ips-v6)"
[[ -n "$V4" && -n "$V6" ]] || { echo "Could not fetch Cloudflare IPs" >&2; exit 1; }
{ for ip in $V4 $V6; do echo "set_real_ip_from $ip;"; done; } > /etc/nginx/cloudflare-realip.conf
{ for ip in $V4 $V6; do echo "$ip 1;"; done; } > /etc/nginx/cloudflare-geo.conf
rm -f /etc/nginx/cloudflare-allow.conf
nginx -t && systemctl reload nginx
