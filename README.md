# Timesheet App

Weekly timesheet PWA — log start/finish times Mon–Sun, track overtime, and email your boss at week end. Built on [SupaDupaBase](https://github.com/johngoodspeed77/supadupabase).

**Production URL (planned):** https://timesheet.whitelynx.co.nz

## Status

**Save point `v0.1.0-local-mvp`** — local dev MVP complete; VM deployment not started.

| Done | Pending |
|------|---------|
| PWA UI (auth, week view, entries, settings, submit) | Proxmox VM + Cloudflare Tunnel |
| Hours / overtime calculator | Production SMTP on VM |
| SupaDupaBase migration `002_timesheet.sql` | Live `timesheet.whitelynx.co.nz` |
| Mail service (`POST /mail/timesheet/submit`) | End-to-end email test with real SMTP |

Details: [SAVEPOINT.md](./SAVEPOINT.md) · Handoff: [AGENT_HANDOFF.md](./AGENT_HANDOFF.md)

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

### 2. Start Timesheet App

```bash
cd "E:/White Lynx Projects/Work Stuff/Timeshhet App"
npm install
npm run dev            # http://localhost:5180
```

Open http://localhost:5180 — sign up, set boss email in Settings, log days, submit week (requires SMTP in SupaDupaBase `.env`).

## What it does

| Feature | Description |
|---------|-------------|
| Auth | Email/password + Google OAuth via SupaDupaBase |
| Daily entry | One start/finish per day; 30 min lunch deducted |
| Overtime | >8h/day OT; Sat 1.5×, Sun 2×; OT stacks on day rate |
| Week view | Mon–Sun navigation with running totals |
| Settings | Per-user boss email and display name |
| Submit | Emails fixed HTML template; locks the week |

## Backend dependency

Timesheet App requires SupaDupaBase with:

- Migration `002_timesheet.sql` applied
- Tables whitelisted in data-api: `user_settings`, `time_entries`, `week_submissions`
- `mail-service` running with SMTP configured

## Config

Inject at deploy time via HTML or reverse proxy:

| Variable | Local default |
|----------|---------------|
| `window.__SDB_AUTH_URL` | `http://localhost:3001` |
| `window.__SDB_DATA_URL` | `http://localhost:3002` |
| `window.__SDB_MAIL_URL` | `http://localhost:3004` |

Production: all three point at `https://supadupabase.whitelynx.co.nz` (Caddy routes `/auth/*`, `/rest/*`, `/mail/*`).

## License

TBD
