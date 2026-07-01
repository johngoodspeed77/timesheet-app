#!/usr/bin/env bash
# Enable HTTPS deploy webhook on VM101 — run from /opt/timesheet-app on the VM
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="infra/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy infra/env.production.example first."
  exit 1
fi

# shellcheck disable=SC1091
source "$ENV_FILE"

if [[ -z "${DEPLOY_HOOK_SECRET:-}" ]]; then
  echo "Add DEPLOY_HOOK_SECRET to $ENV_FILE first:"
  echo "  openssl rand -base64 32"
  exit 1
fi

chmod +x infra/deploy-quick.sh 2>/dev/null || true

export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

if [[ "${DOCKER_SUDO:-}" == "1" ]] || ! groups | grep -q '\bdocker\b'; then
  COMPOSE="sudo docker compose -f infra/docker-compose.yml --env-file $ENV_FILE"
else
  COMPOSE="docker compose -f infra/docker-compose.yml --env-file $ENV_FILE"
fi

echo "==> Pull latest"
git fetch origin main
git merge --ff-only origin/main

echo "==> Start deploy-hook"
$COMPOSE --profile remote up -d --build deploy-hook

echo "==> Health"
sleep 2
curl -fsS "http://localhost:${DEPLOY_HOOK_PORT:-5189}/hooks/healthz" | head -c 200
echo ""
echo "Done. Ensure Cloudflare routes /hooks/* to port ${DEPLOY_HOOK_PORT:-5189}."
