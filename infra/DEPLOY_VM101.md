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
curl -fsSL https://raw.githubusercontent.com/johngoodspeed77/timesheet-app/main/infra/setup-vm101.sh | bash -s create-env
```

Enter your **Ubuntu VM login password** when you see `Password:` — that is sudo, not Gmail.

Edit secrets:

```bash
nano /opt/supadupabase/.env
```

Deploy:

```bash
curl -fsSL https://raw.githubusercontent.com/johngoodspeed77/timesheet-app/main/infra/setup-vm101.sh | bash
```

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

**Option A — Cloudflare Tunnel** (recommended)

SupaDupaBase tunnel is already live at `https://supadupabase.whitelynx.co.nz` when `TUNNEL_TOKEN` is set and cloudflared is running:

```bash
cd /opt/supadupabase
docker compose -f infra/docker-compose.yml --env-file .env --profile tunnel up -d cloudflared
```

Add a **second public hostname** on the same tunnel (Cloudflare Zero Trust → Networks → Tunnels → your tunnel → Public Hostname):

| Field | Value |
|-------|--------|
| Subdomain | `timesheet` |
| Domain | `whitelynx.co.nz` |
| Type | HTTP |
| URL | `http://192.168.1.19:5180` |

Cloudflare DNS should auto-create a CNAME for `timesheet.whitelynx.co.nz` when you save the hostname. If not, add a CNAME pointing at `<tunnel-id>.cfargotunnel.com`.

Verify:

```bash
curl https://supadupabase.whitelynx.co.nz/auth/healthz
curl -I https://timesheet.whitelynx.co.nz/
```

The timesheet PWA uses **same-origin** proxying on `:5180`, so the public timesheet URL does not need separate `__SDB_*_URL` values — auth/rest/mail are proxied through the timesheet container.

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

## Weekly reminder (Sunday 3pm NZ)

1. Generate VAPID keys on VM101 and add to `/opt/supadupabase/.env`:

```bash
npx web-push generate-vapid-keys
# Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT to .env
# Copy VAPID_PUBLIC_KEY to /opt/timesheet-app/infra/.env as well
```

2. In Timesheet App **Settings**, enable **Weekly reminder** and allow notifications when prompted.

3. Schedule Sunday 3:00 PM Pacific/Auckland cron on VM101:

```bash
sudo crontab -e
# Add:
0 15 * * 0 TZ=Pacific/Auckland /opt/supadupabase/infra/send-weekly-reminders.sh >> /var/log/timesheet-reminders.log 2>&1
```

Requires the PWA to be installed on the phone and reminders enabled in Settings.
