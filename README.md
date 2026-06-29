# Timesheet App

Weekly timesheet PWA — log start/finish times Mon–Sun, track overtime, and email your boss at week end. Built on [SupaDupaBase](https://github.com/johngoodspeed77/supadupabase).

**Repository:** https://github.com/johngoodspeed77/timesheet-app

**Production:** https://timesheet.whitelynx.co.nz *(VM101)* → backend https://supadupabase.whitelynx.co.nz *(VM106)*

## Status

**Option B live** — Timesheet PWA on VM101; SupaDupaBase on VM106. Open both repos via `whitelynx.code-workspace` in Cursor.

| Done | Pending |
|------|---------|
| PWA + tunnel `timesheet.whitelynx.co.nz` | VM101 redeploy with Option B `.env` |
| Option B config (`SDB_PUBLIC_URL`, `SDB_PROXY=0`) | VM106 migration `007` |
| Persistent login (`lib/session.js`) | Google OAuth for production origin |
| Mon–Fri auto-fill, week submit, reminders | SMTP e2e on VM106 |

Details: [SAVEPOINT.md](./SAVEPOINT.md) · Handoff: [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) · Stack: [SupaDupaBase STACK.md](../Cursor/supadupabase/docs/STACK.md)

## Quick start (local)

Open **`E:\White Lynx Projects\Cursor\whitelynx.code-workspace`** in Cursor to edit both repos.

### 1. Start SupaDupaBase

```bash
cd ../Cursor/supadupabase
npm install && npm run build
cp .env.example .env   # set ADMIN_EMAILS, AUTH_SECRET, SMTP_* for submit
docker compose -f infra/docker-compose.dev.yml up -d
npm run migrate
npm run dev            # auth :3001, data :3002, mail :3004
```

Apply timesheet migrations through `006_default_start_8am.sql` (includes weekly reminders).

### 2. Start Timesheet App

```bash
cd "E:/White Lynx Projects/Work Stuff/Timeshhet App"
npm install
npm run dev            # http://localhost:5180
```

Open http://localhost:5180 — sign up, set boss email in Settings, log days, submit week (requires SMTP in SupaDupaBase `.env`).

## Deploy on VM101

See [infra/DEPLOY_VM101.md](./infra/DEPLOY_VM101.md). After code changes:

```bash
cd /opt/timesheet-app
DOCKER_BUILDKIT=0 docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build timesheet-app
```

On VM101 the PWA is static-only; API calls go to VM106. Local dev uses separate ports via `config.js`.

## What it does

| Feature | Description |
|---------|-------------|
| Auth | Email/password + Google OAuth via SupaDupaBase |
| Daily entry | One start/finish per day; 30 min lunch deducted |
| Auto-fill | Mon–Fri pre-filled from default start (8:00 → 16:30 clock, 8 h worked); Sat/Sun manual |
| Overtime | >8h/day OT; Sat 1.5×, Sun 2×; OT stacks on day rate |
| Week view | Mon–Sun navigation with running totals |
| Settings | Boss email, display name, default start time, weekly reminder toggle |
| Submit | Emails fixed HTML template; locks the week |
| Reminders | Optional Sunday 3:00 PM NZ push notification (requires VAPID keys + cron on VM) |

## Backend dependency

Timesheet App requires SupaDupaBase with:

- Migrations through `006_default_start_8am.sql` (and `005_weekly_reminders.sql` for push)
- Tables whitelisted in data-api: `user_settings`, `time_entries`, `week_submissions`, `push_subscriptions`
- `mail-service` running with SMTP configured
- VAPID keys in `.env` for weekly push reminders

## Config

| Variable | Local default | VM101 (Docker) |
|----------|---------------|----------------|
| `window.__SDB_AUTH_URL` | `http://localhost:3001` | *(empty → same origin)* |
| `window.__SDB_DATA_URL` | `http://localhost:3002` | *(empty → same origin)* |
| `window.__SDB_MAIL_URL` | `http://localhost:3004` | *(empty → same origin)* |
| `VAPID_PUBLIC_KEY` | — | In `infra/.env` for push subscribe |

Production (public): all three point at `https://supadupabase.whitelynx.co.nz` or same-origin via reverse proxy.

## Troubleshooting

- **Sign in does nothing / blank screen:** Hard refresh (Ctrl+Shift+R). A broken `app.js` may be cached by the service worker — clear site data for the host if needed.
- **Submit fails:** Check SupaDupaBase `SMTP_*` env vars and boss email in Settings.
- **Reminders:** Enable in Settings, allow notifications, install PWA on phone; VM needs VAPID keys and Sunday cron (see DEPLOY_VM101.md).

## License

TBD
