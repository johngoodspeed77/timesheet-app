#!/usr/bin/env bash
# Timesheet App + SupaDupaBase — VM101 bootstrap
# Run on Ubuntu VM101 (192.168.1.19). Uses sudo — enter your Ubuntu login password when asked.
set -euo pipefail

SDB_REPO="${SDB_REPO:-https://github.com/johngoodspeed77/supadupabase.git}"
TS_REPO="${TS_REPO:-https://github.com/johngoodspeed77/timesheet-app.git}"
SDB_DIR="${SDB_DIR:-/opt/supadupabase}"
TS_DIR="${TS_DIR:-/opt/timesheet-app}"
VM_IP="${VM_IP:-192.168.1.19}"

docker_compose() {
  if groups | grep -q '\bdocker\b'; then
    docker compose "$@"
  else
    sudo docker compose "$@"
  fi
}

require_sudo() {
  echo ""
  echo "==> Sudo required — enter your Ubuntu VM login password when prompted"
  echo "    (This is NOT your Gmail password or any .env secret.)"
  echo ""
  sudo -v
}

create_env_files() {
  require_sudo
  sudo mkdir -p "$SDB_DIR" "$TS_DIR/infra"
  sudo chown "$USER:$USER" "$SDB_DIR" "$TS_DIR"

  if [[ ! -f "$SDB_DIR/.env" ]]; then
    if [[ -d "$SDB_DIR/infra" ]]; then
      cp "$SDB_DIR/infra/env.production.example" "$SDB_DIR/.env"
    else
      echo "Clone supadupabase first, then run: $0 create-env"
      exit 1
    fi
    echo "Created $SDB_DIR/.env"
  else
    echo "$SDB_DIR/.env already exists"
  fi

  if [[ ! -f "$TS_DIR/infra/.env" ]]; then
    mkdir -p "$TS_DIR/infra"
    cat > "$TS_DIR/infra/.env" <<EOF
SDB_PUBLIC_URL=http://${VM_IP}
TIMESHEET_PORT=5180
EOF
    echo "Created $TS_DIR/infra/.env"
  else
    echo "$TS_DIR/infra/.env already exists"
  fi

  echo ""
  echo "Edit secrets before deploy:"
  echo "  nano $SDB_DIR/.env"
  echo ""
  echo "Set at minimum: POSTGRES_PASSWORD, AUTH_SECRET, ADMIN_EMAILS, SMTP_PASS"
  echo "Generate secrets: openssl rand -base64 32"
}

case "${1:-deploy}" in
  create-env)
    create_env_files
    exit 0
    ;;
  deploy) ;;
  *)
    echo "Usage: $0 [create-env|deploy]"
    exit 1
    ;;
esac

echo "==> VM101 setup: SupaDupaBase + Timesheet App"
require_sudo

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker (sudo password may be requested again)"
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-v2 git curl
  sudo usermod -aG docker "$USER"
  echo ""
  echo "Docker installed. This script will use 'sudo docker' for now."
  echo "After setup, log out/in once so you can run docker without sudo."
fi

if ! groups | grep -q '\bdocker\b'; then
  echo "==> Adding $USER to docker group (optional — script uses sudo docker until re-login)"
  sudo usermod -aG docker "$USER" || true
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
  create_env_files
  exit 1
fi

chmod +x "$SDB_DIR/infra/deploy.sh"
DOCKER_SUDO=1 "$SDB_DIR/infra/deploy.sh"

mkdir -p "$TS_DIR/infra"
cat > "$TS_DIR/infra/.env" <<EOF
SDB_PUBLIC_URL=${SDB_PUBLIC_URL:-http://${VM_IP}}
TIMESHEET_PORT=5180
EOF

docker_compose -f "$TS_DIR/infra/docker-compose.yml" --env-file "$TS_DIR/infra/.env" up -d --build

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
