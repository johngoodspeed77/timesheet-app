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

run_in_node() {
  local cmd="$1"
  if groups | grep -q '\bdocker\b'; then
    docker run --rm -v "$SDB_DIR:/app" -w /app node:22-alpine sh -c "$cmd"
  else
    sudo docker run --rm -v "$SDB_DIR:/app" -w /app node:22-alpine sh -c "$cmd"
  fi
}

build_sdk() {
  if [[ -f "$SDB_DIR/packages/sdk/dist/index.js" ]]; then
    echo "==> SDK already built"
    return 0
  fi
  echo "==> Building @supadupabase/sdk (not stored in git — compiled on VM)"
  run_in_node "npm install && npm run build -w @supadupabase/sdk"
}

sync_timesheet_sdk() {
  build_sdk
  mkdir -p "$TS_DIR/sdk"
  cp -r "$SDB_DIR/packages/sdk/dist/." "$TS_DIR/sdk/"
}

require_sudo() {
  echo ""
  echo "==> Sudo required — enter your Ubuntu VM login password when prompted"
  echo "    (This is NOT your Gmail password or any .env secret.)"
  echo ""
  sudo -v
}

ensure_repo() {
  local repo_url="$1"
  local dir="$2"

  if [[ -d "$dir/.git" ]]; then
    echo "==> Updating $(basename "$dir")"
    git -C "$dir" pull --ff-only || true
    return 0
  fi

  if [[ -e "$dir" ]]; then
    echo "==> Removing incomplete $(basename "$dir") at $dir"
    sudo rm -rf "$dir"
  fi

  echo "==> Cloning $(basename "$dir")"
  git clone "$repo_url" "$dir"
}

clone_repos() {
  sudo mkdir -p /opt
  sudo chown "$USER:$USER" /opt 2>/dev/null || true
  ensure_repo "$SDB_REPO" "$SDB_DIR"
  ensure_repo "$TS_REPO" "$TS_DIR"
  sudo chown -R "$USER:$USER" "$SDB_DIR" "$TS_DIR"
}

create_env_files() {
  clone_repos

  if [[ ! -f "$SDB_DIR/.env" ]]; then
    cp "$SDB_DIR/infra/env.production.example" "$SDB_DIR/.env"
    echo "Created $SDB_DIR/.env"
  else
    echo "$SDB_DIR/.env already exists"
  fi

  mkdir -p "$TS_DIR/infra"
  if [[ ! -f "$TS_DIR/infra/.env" ]]; then
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
    require_sudo
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
  echo "==> Adding $USER to docker group (script uses sudo docker until re-login)"
  sudo usermod -aG docker "$USER" || true
fi

clone_repos

sync_timesheet_sdk

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
