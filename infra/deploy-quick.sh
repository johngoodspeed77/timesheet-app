#!/usr/bin/env bash
# Fast production update for Timesheet VM101 (used by deploy-hook)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${DOCKER_SUDO:-}" == "1" ]] || { [[ "$(id -u)" -ne 0 ]] && ! groups | grep -q '\bdocker\b'; }; then
  COMPOSE="sudo docker compose -f infra/docker-compose.yml --env-file infra/.env"
else
  COMPOSE="docker compose -f infra/docker-compose.yml --env-file infra/.env"
fi

export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-0}"
export COMPOSE_DOCKER_CLI_BUILD="${COMPOSE_DOCKER_CLI_BUILD:-0}"

if [[ ! -f infra/.env ]]; then
  echo "Missing infra/.env in $ROOT"
  exit 1
fi

echo "==> Pull latest from origin/main"
git fetch origin main
git merge --ff-only origin/main
echo "==> At commit $(git rev-parse --short HEAD)"

echo "==> Rebuild timesheet-app"
$COMPOSE up -d --build timesheet-app

# shellcheck disable=SC1091
source infra/.env
if [[ -n "${DEPLOY_HOOK_SECRET:-}" ]]; then
  $COMPOSE --profile remote up -d deploy-hook
fi

echo "==> Done"
$COMPOSE ps
