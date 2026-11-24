#!/usr/bin/env bash
# One-time bootstrap of a fresh Ubuntu 24.04 EC2 instance (ap-south-1). Run as root.
# Installs Node 22 LTS, pnpm, PM2, Nginx, Redis (localhost only), AWS CLI; creates the `sgh` user and folders.
set -euo pipefail

apt-get update && apt-get -y upgrade
apt-get install -y curl ca-certificates gnupg nginx redis-server unattended-upgrades jq unzip
dpkg-reconfigure -f noninteractive unattended-upgrades

# Node.js 22 LTS + pnpm + PM2
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pnpm@10 pm2@latest

# AWS CLI v2 (reads SSM parameters via the instance role — no static keys on the server)
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscli.zip
unzip -q /tmp/awscli.zip -d /tmp && /tmp/aws/install && rm -rf /tmp/aws /tmp/awscli.zip

# Redis: localhost only, password required, AOF persistence (sessions, rate limits, queue)
REDIS_PASS="$(aws ssm get-parameter --with-decryption --name /sgh/prod/redis/password --query Parameter.Value --output text)"
sed -i "s/^# *requirepass .*/requirepass ${REDIS_PASS}/; s/^bind .*/bind 127.0.0.1 -::1/; s/^appendonly no/appendonly yes/" /etc/redis/redis.conf
systemctl enable --now redis-server && systemctl restart redis-server

# App user and layout: /srv/sgh/{releases,shared,current}
id sgh >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash sgh
mkdir -p /srv/sgh/releases /srv/sgh/shared /var/log/sgh
chown -R sgh:sgh /srv/sgh /var/log/sgh
chmod 750 /srv/sgh/shared

# Nginx: site config + Cloudflare IP lists
install -m 644 "$(dirname "$0")/../nginx/shivanshigaming.conf" /etc/nginx/sites-available/shivanshigaming.conf
ln -sf /etc/nginx/sites-available/shivanshigaming.conf /etc/nginx/sites-enabled/shivanshigaming.conf
rm -f /etc/nginx/sites-enabled/default
bash "$(dirname "$0")/update-cloudflare-ips.sh"
mkdir -p /etc/ssl/cloudflare && chmod 700 /etc/ssl/cloudflare
echo ">>> Put the Cloudflare Origin Certificate in /etc/ssl/cloudflare/origin.pem + origin.key"
echo ">>> and the Authenticated Origin Pull CA in /etc/ssl/cloudflare/authenticated_origin_pull_ca.pem, then: nginx -t && systemctl reload nginx"

# PM2 on boot (as sgh) + log rotation
sudo -u sgh pm2 install pm2-logrotate
env PATH="$PATH:/usr/bin" pm2 startup systemd -u sgh --hp /home/sgh
echo "Server setup complete."
