#!/usr/bin/env bash
# =============================================================================
# GrandXL — First-time EC2 server setup
# Run this ONCE on a fresh Ubuntu 22.04 / 24.04 EC2 instance.
#
# Usage:
#   chmod +x scripts/server-setup.sh
#   sudo ./scripts/server-setup.sh
# =============================================================================
set -euo pipefail

REPO_URL="https://github.com/gbadass/grandxl.git"   # ← update if different
APP_DIR="/root/grandxl"
DEPLOY_USER="root"

echo "========================================"
echo "  GrandXL — Server Setup"
echo "========================================"

# ── System packages ───────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y \
  git curl wget unzip ufw \
  ca-certificates gnupg lsb-release

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  # Allow ubuntu user to run Docker without sudo
  usermod -aG docker $DEPLOY_USER
  echo "Docker installed."
else
  echo "Docker already installed — skipping."
fi

# ── UFW firewall ──────────────────────────────────────────────────────────────
echo "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "Firewall configured."

# ── Clone repo ────────────────────────────────────────────────────────────────
if [ ! -d "$APP_DIR" ]; then
  echo "Cloning repository..."
  git clone "$REPO_URL" "$APP_DIR"
  chown -R $DEPLOY_USER:$DEPLOY_USER "$APP_DIR"
  echo "Repository cloned to $APP_DIR"
else
  echo "Repository already exists at $APP_DIR — pulling latest..."
  cd "$APP_DIR"
  git pull origin main
fi

# ── Production env file ───────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env.production" ]; then
  cp "$APP_DIR/.env.production.example" "$APP_DIR/.env.production"
  echo ""
  echo "========================================"
  echo "  ACTION REQUIRED"
  echo "========================================"
  echo "  Edit $APP_DIR/.env.production"
  echo "  Fill in all secrets before deploying."
  echo "========================================"
else
  echo ".env.production already exists — skipping."
fi

# ── SSL directory ─────────────────────────────────────────────────────────────
mkdir -p "$APP_DIR/nginx/ssl"
chown -R $DEPLOY_USER:$DEPLOY_USER "$APP_DIR/nginx/ssl"

echo ""
echo "========================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Edit $APP_DIR/.env.production"
echo "  2. Point your DNS A records to $(curl -s ifconfig.me)"
echo "  3. Run: sudo ./scripts/ssl-init.sh"
echo "  4. Run: docker compose -f docker-compose.prod.yml up -d"
echo "========================================"
