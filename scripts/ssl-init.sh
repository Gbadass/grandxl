#!/usr/bin/env bash
# =============================================================================
# GrandXL — Let's Encrypt SSL certificate setup
#
# Run this AFTER:
#   1. DNS A records are pointing to this server's IP
#   2. server-setup.sh has been run
#
# Usage:
#   sudo ./scripts/ssl-init.sh
# =============================================================================
set -euo pipefail

APP_DIR="/root/grandxl"
SSL_DIR="$APP_DIR/nginx/ssl"
EMAIL="admin@grandxl.com"    # ← change to your email
DOMAINS=(
  "grandxl.com"
  "www.grandxl.com"
  "api.grandxl.com"
  "admin.grandxl.com"
)

echo "========================================"
echo "  GrandXL — SSL Certificate Setup"
echo "========================================"

# ── Install certbot ───────────────────────────────────────────────────────────
if ! command -v certbot &>/dev/null; then
  apt-get update -y
  apt-get install -y certbot
fi

# ── Step 1: Start nginx on HTTP only (no SSL yet) ─────────────────────────────
# We need nginx running to serve the ACME challenge on port 80.
# Temporarily use a minimal HTTP-only config.
echo "Starting nginx for ACME challenge..."

mkdir -p "$APP_DIR/certbot_webroot"

docker run --rm -d \
  --name certbot-nginx \
  -p 80:80 \
  -v "$APP_DIR/certbot_webroot:/var/www/certbot" \
  nginx:alpine \
  sh -c "echo 'server { listen 80; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 200 \"ok\"; } }' > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"

sleep 2

# ── Step 2: Issue certificate ─────────────────────────────────────────────────
DOMAIN_ARGS=""
for domain in "${DOMAINS[@]}"; do
  DOMAIN_ARGS="$DOMAIN_ARGS -d $domain"
done

echo "Requesting certificate for: ${DOMAINS[*]}"

certbot certonly \
  --webroot \
  --webroot-path="$APP_DIR/certbot_webroot" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  $DOMAIN_ARGS

# ── Step 3: Stop temporary nginx ─────────────────────────────────────────────
docker stop certbot-nginx 2>/dev/null || true

# ── Step 4: Copy certs to nginx/ssl ──────────────────────────────────────────
CERT_DIR="/etc/letsencrypt/live/grandxl.com"

if [ -d "$CERT_DIR" ]; then
  cp "$CERT_DIR/fullchain.pem" "$SSL_DIR/fullchain.pem"
  cp "$CERT_DIR/privkey.pem"   "$SSL_DIR/privkey.pem"
  chmod 644 "$SSL_DIR/fullchain.pem"
  chmod 600 "$SSL_DIR/privkey.pem"
  echo "Certificates copied to $SSL_DIR"
else
  echo "ERROR: Certificate directory not found at $CERT_DIR"
  exit 1
fi

# ── Step 5: Auto-renewal cron ────────────────────────────────────────────────
# Runs certbot renew at 3am on the 1st of every month, then copies & reloads nginx
CRON_CMD="0 3 1 * * certbot renew --quiet && cp $CERT_DIR/fullchain.pem $SSL_DIR/fullchain.pem && cp $CERT_DIR/privkey.pem $SSL_DIR/privkey.pem && docker exec grandxl-nginx nginx -s reload"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_CMD") | crontab -

echo ""
echo "========================================"
echo "  SSL setup complete!"
echo ""
echo "  Certificates: $SSL_DIR"
echo "  Auto-renewal: Monthly via cron"
echo ""
echo "  Now run:"
echo "  cd $APP_DIR"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo "========================================"
