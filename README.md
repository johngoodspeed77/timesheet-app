# Timesheet App

Weekly timesheet PWA — log start/finish times Mon–Sun, track overtime, and email your boss at week end. Built on [SupaDupaBase](https://github.com/johngoodspeed77/supadupabase).

**Repository:** https://github.com/johngoodspeed77/timesheet-app

**Production:** https://timesheet.whitelynx.co.nz *(VM101)* → backend https://supadupabase.whitelynx.co.nz *(VM106)*

## Status

**Save point `v0.2.0-production`** (2026-06-29) — **production live.** Invite-only sign-in, inline day editing, persistent login, week submit.

| Done | Follow-up |
|------|-----------|
| PWA + tunnel `timesheet.whitelynx.co.nz` | Data API date-range filters |
| Option B (`SDB_PROXY=0`, cross-origin API) | Google OAuth (optional; UI removed) |
| Invite-only auth + admin invite links | Integration tests |
| Inline Mon–Sun row editing + quarter-hour times | License |
| Login race fix + **↻ Refresh** cache button | |

Details: [SAVEPOINT.md](./SAVEPOINT.md) · Handoff: [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) · Stack: [SupaDupaBase STACK.md](../Cursor/supadupabase/docs/STACK.md)

**Cursor workspace:** `E:\White Lynx Projects\Cursor\whitelynx.code-workspace`

## Quick start (local)

### 1. Start SupaDupaBase

```bash
cd ../Cursor/supadupabase
npm install && npm run build
cp .env.example .env   # set ADMIN_EMAILS, AUTH_SECRET, SMTP_* for submit
docker compose -f infra/docker-compose.dev.yml up -d
npm run migrate
npm run dev            # auth :3001, data :3002, mail :3004
```

Apply timesheet migrations through `008_user_management.sql` in the SupaDupaBase repo.

### 2. Start Timesheet App

```bash
cd "E:/White Lynx Projects/Work Stuff/Timeshhet App"
npm install
npm run dev            # http://localhost:5180
```

Open http://localhost:5180 — create a user via SupaDupaBase admin invite (production is invite-only), set boss email in Settings, log days, submit week (requires SMTP in SupaDupaBase `.env`).

### Tests

```bash
npm test               # hours.js overtime / lunch math
```

## Deploy on VM101

See [infra/DEPLOY_VM101.md](./infra/DEPLOY_VM101.md). After code changes:

```bash
cd /opt/timesheet-app
git pull
DOCKER_BUILDKIT=0 docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

On VM101 the PWA is static-only; API calls go to VM106. `config.js` is generated at container start from `infra/.env`.

## What it does

| Feature | Description |
|---------|-------------|
| Auth | Invite-only email/password via SupaDupaBase (`INVITE_ONLY=1` on VM106) |
| Daily entry | Inline start/finish per day row; 30 min lunch deducted |
| Auto-fill | Mon–Fri pre-filled from default start (8:00 → 16:30 clock, 8 h worked) |
| Overtime | >8 h/day OT; Sat 1.5×, Sun 2×; OT stacks on day rate |
| Week view | Mon–Sun navigation with running totals |
| Settings | Boss email, display name, default start time, weekly reminder toggle |
| Submit | Emails fixed HTML template; locks the week |
| Reminders | Optional Sunday 3:00 PM NZ push (VAPID + cron on VM106) |
| Refresh | **↻ Refresh** on sign-in — clears SW cache when app feels stuck |

## Backend dependency

Timesheet App requires SupaDupaBase with:

- Migrations through `008_user_management.sql`
- Tables whitelisted in data-api: `user_settings`, `time_entries`, `week_submissions`, `push_subscriptions`
- `mail-service` running with SMTP configured
- `INVITE_ONLY=1` in production `.env` (wired through `docker-compose.yml`)
- VAPID keys for weekly push reminders (optional)

## Config

| Variable | Local default | VM101 (Docker) |
|----------|---------------|----------------|
| `window.__SDB_AUTH_URL` | `http://localhost:3001` | `https://supadupabase.whitelynx.co.nz` |
| `window.__SDB_DATA_URL` | `http://localhost:3002` | `https://supadupabase.whitelynx.co.nz` |
| `window.__SDB_MAIL_URL` | `http://localhost:3004` | `https://supadupabase.whitelynx.co.nz` |
| `VAPID_PUBLIC_KEY` | — | In `infra/.env` |

## Troubleshooting

- **Sign-in does nothing / old UI:** Tap **↻ Refresh** on the sign-in page (top-right). Clears service worker caches and reloads.
- **Invalid password:** Production is invite-only — use the account your admin invited.
- **Submit fails:** Check SupaDupaBase `SMTP_*` env vars and boss email in Settings.
- **Reminders:** Enable in Settings, allow notifications, install PWA; VM106 needs VAPID keys and Sunday cron.

## License

TBD
