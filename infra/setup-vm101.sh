#!/usr/bin/env bash
# Timesheet App + SupaDupaBase — VM101 bootstrap
# Run on Ubuntu VM101 (192.168.1.19) as a user with sudo + docker access.
set -euo pipefail

SDB_REPO="${SDB_REPO:-https://github.com/johngoodspeed77/supadupabase.git}"
TS_REPO="${TS_REPO:-https://github.com/johngoodspeed77/timesheet-app.git}"
SDB_DIR="${SDB_DIR:-/opt/supadupabase}"
TS_DIR="${TS_DIR:-/opt/timesheet-app}"
VM_IP="${VM_IP:-192.168.1.19}"

echo "==> VM101 setup: SupaDupaBase + Timesheet App"

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-v2 git curl
  sudo usermod -aG docker "$USER"
  echo "Log out and back in so docker group applies, then re-run this script."
  exit 0
fi

if ! groups | grep -q docker; then
  echo "Add $USER to docker group: sudo usermod -aG docker $USER && newgrp docker"
  exit 1
fi

sudo mkdir -p "$SDB_DIR" "$TS_DIR"
sudo chown "$USER:$USER" "$SDB_DIR" "$TS_DIR"

if [[ ! -d "$SDB_DIR/.git" ]]; then
  git clone "$SDB_REPO" "$SDB_DIR"
else
  git -C "$SDB_DIR" pull --ff-only || true
fi

if [[ ! -d "$TS_DIR/.git" ]]; then
  git clone "$TS_REPO" "$TS_DIR"
else
  git -C "$TS_DIR" pull --ff-only || true
fi

mkdir -p "$TS_DIR/sdk"
cp -r "$SDB_DIR/packages/sdk/dist/." "$TS_DIR/sdk/"

if [[ ! -f "$SDB_DIR/.env" ]]; then
  cp "$SDB_DIR/infra/env.production.example" "$SDB_DIR/.env"
  echo ""
  echo "Created $SDB_DIR/.env — edit secrets before continuing:"
  echo "  POSTGRES_PASSWORD, AUTH_SECRET, ADMIN_EMAILS, TUNNEL_TOKEN (optional), SMTP_*"
  echo "Generate: openssl rand -base64 32"
  exit 1
fi

chmod +x "$SDB_DIR/infra/deploy.sh"
"$SDB_DIR/infra/deploy.sh"

cat > "$TS_DIR/infra/.env" <<EOF
SDB_PUBLIC_URL=${SDB_PUBLIC_URL:-http://${VM_IP}}
TIMESHEET_PORT=5180
EOF

docker compose -f "$TS_DIR/infra/docker-compose.yml" --env-file "$TS_DIR/infra/.env" up -d --build

echo ""
echo "==> VM101 deploy complete"
echo "  SupaDupaBase (LAN): http://${VM_IP}/admin/"
echo "  Timesheet App:      http://${VM_IP}:5180/"
echo ""
echo "Next: Cloudflare tunnel hostnames → http://${VM_IP} and :5180"
echo "  supadupabase.whitelynx.co.nz → Caddy :80 on this VM"
echo "  timesheet.whitelynx.co.nz    → Timesheet :5180"
echo ""
echo "Or use NPM (VM104) as reverse proxy to these LAN URLs."
