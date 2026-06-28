# Deploy on VM101 (Ubuntu @ 192.168.1.19)

VM101 is the target host for **SupaDupaBase** (backend) and **Timesheet App** (PWA).

## Prerequisites

- VM101 running Ubuntu with static IP **192.168.1.19**
- Docker + Docker Compose v2
- Git
- `.env` secrets for SupaDupaBase (see below)

## One-command bootstrap

On VM101 (Proxmox console or SSH):

```bash
curl -fsSL https://raw.githubusercontent.com/johngoodspeed77/timesheet-app/main/infra/setup-vm101.sh | bash
```

First run creates `/opt/supadupabase/.env` from the example and exits — edit secrets, then re-run.

## Manual steps

### 1. SupaDupaBase

```bash
sudo mkdir -p /opt/supadupabase /opt/timesheet-app
sudo chown $USER:$USER /opt/supadupabase /opt/timesheet-app
git clone https://github.com/johngoodspeed77/supadupabase.git /opt/supadupabase
cd /opt/supadupabase
cp infra/env.production.example .env
nano .env   # POSTGRES_PASSWORD, AUTH_SECRET, ADMIN_EMAILS, SMTP_*, TUNNEL_TOKEN
./infra/deploy.sh
```

Verify:

```bash
curl http://192.168.1.19/auth/healthz
curl http://192.168.1.19/rest/healthz
curl http://192.168.1.19/mail/healthz
```

### 2. Timesheet App

```bash
git clone https://github.com/johngoodspeed77/timesheet-app.git /opt/timesheet-app
mkdir -p /opt/timesheet-app/sdk
cp -r /opt/supadupabase/packages/sdk/dist/. /opt/timesheet-app/sdk/
cp infra/env.production.example /opt/timesheet-app/infra/.env
cd /opt/timesheet-app
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

Open http://192.168.1.19:5180

### 3. Public access

**Option A — Cloudflare Tunnel** (recommended in SupaDupaBase docs)

- `supadupabase.whitelynx.co.nz` → `http://caddy:80` (tunnel on VM101)
- `timesheet.whitelynx.co.nz` → `http://192.168.1.19:5180`

**Option B — Nginx Proxy Manager (VM104)**

- Proxy host: `supadupabase.whitelynx.co.nz` → `http://192.168.1.19:80`
- Proxy host: `timesheet.whitelynx.co.nz` → `http://192.168.1.19:5180`

After public URLs work, update Timesheet `infra/.env`:

```
SDB_PUBLIC_URL=https://supadupabase.whitelynx.co.nz
```

Then `docker compose ... up -d --build` to regenerate `config.js`.

## Notes

- VM106 (SupaDupaBase) exists but is **not used** — stack runs on VM101 per plan.
- SupaDupaBase `deploy.sh` starts: postgres, auth, data-api, **mail-service**, admin, caddy.
- SMTP must be configured for weekly timesheet email submit.
