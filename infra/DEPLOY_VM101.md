# Deploy Timesheet on VM101 (Option B)

**VM101** (`192.168.1.19`) runs **only the Timesheet PWA**.  
**VM106** (`192.168.1.112`) runs **SupaDupaBase** at https://supadupabase.whitelynx.co.nz.

The browser loads the app from `https://timesheet.whitelynx.co.nz` and calls the backend on VM106 over HTTPS (CORS). No Docker `infra_sdb` network required on VM101.

Full stack map: [SupaDupaBase docs/STACK.md](../../Cursor/supadupabase/docs/STACK.md)

## Prerequisites

- VM101: Ubuntu, Docker, Git
- VM106: SupaDupaBase deployed and healthy
- Cloudflare tunnel: `timesheet.whitelynx.co.nz` → `http://192.168.1.19:5180` (or container hostname)
- Migration `007_timesheet_public_origins.sql` applied on VM106

## 1. Timesheet App on VM101

```bash
sudo mkdir -p /opt/timesheet-app
sudo chown $USER:$USER /opt/timesheet-app
git clone https://github.com/johngoodspeed77/timesheet-app.git /opt/timesheet-app
cd /opt/timesheet-app
mkdir -p sdk
# Copy SDK from your dev PC or build from supadupabase repo:
# scp -r packages/sdk/dist/* supadupabase@192.168.1.112:...  OR from dev machine to VM101
cp infra/env.production.example infra/.env
nano infra/.env
```

`infra/.env` (Option B defaults):

```env
TIMESHEET_PORT=5180
SDB_PUBLIC_URL=https://supadupabase.whitelynx.co.nz
SDB_PROXY=0
VAPID_PUBLIC_KEY=<from VM106 .env>
```

Deploy:

```bash
DOCKER_BUILDKIT=0 docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

Verify:

```bash
curl -s http://localhost:5180/ | head
curl -s https://supadupabase.whitelynx.co.nz/auth/healthz
```

Open https://timesheet.whitelynx.co.nz — sign in (API goes to VM106).

## 2. SupaDupaBase on VM106 (backend only)

See [supadupabase/infra/DEPLOY_AT_HOME.md](../../Cursor/supadupabase/infra/DEPLOY_AT_HOME.md).

After pull:

```bash
cd ~/supadupabase
docker compose -f infra/docker-compose.yml --env-file .env up -d --build
docker compose -f infra/docker-compose.yml --env-file .env --profile migrate run --rm migrate
```

Ensure SMTP and VAPID are set for week submit and push reminders.

## 3. Google OAuth (optional)

Google Cloud Console → redirect URI:

`https://supadupabase.whitelynx.co.nz/auth/callback/google`

Timesheet “Sign in with Google” uses `redirect_to=https://timesheet.whitelynx.co.nz`.

## Local dev (both repos)

Open **`whitelynx.code-workspace`** in Cursor (`E:\White Lynx Projects\Cursor\whitelynx.code-workspace`).

```bash
# Terminal 1 — SupaDupaBase
cd supadupabase && npm run dev

# Terminal 2 — Timesheet
cd "Timeshhet App" && npm run dev
```

Timesheet `config.js` uses `localhost:3001/3002/3004`. Set `SDB_PROXY=1` only if you enable LAN proxy mode (not needed for normal local dev).

## Rebuild after code changes

```bash
cd /opt/timesheet-app
git pull
DOCKER_BUILDKIT=0 docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

Hard refresh the PWA (Ctrl+Shift+R) after deploy — service worker may cache old `config.js`.
