# Save point — v0.1.0-local-mvp

**Date:** 2026-06-28  
**Git tag:** `v0.1.0-local-mvp` (create after commit when ready)  
**Workspace:** `E:\White Lynx Projects\Work Stuff\Timeshhet App`

## Milestone summary

Local-development MVP is **complete**. SupaDupaBase backend extensions and Timesheet App PWA are wired for local dev. Production VM deployment is **not started**.

## What works

- **Timesheet App PWA** at http://localhost:5180
  - Sign up / sign in / Google OAuth (via SupaDupaBase)
  - Settings: boss email, employee name
  - Mon–Sun week view with prev/next navigation
  - Add / edit / delete daily entries (start/finish, 30 min lunch)
  - Week totals: hours, regular, OT, paid equivalent
  - Submit button → mail-service (requires SMTP configured)
- **SupaDupaBase extensions** (sibling repo)
  - Migration `002_timesheet.sql`
  - Data API tables: `user_settings`, `time_entries`, `week_submissions`
  - `mail-service` on port 3004

## Not done yet

- Proxmox VM provisioning
- Cloudflare Tunnel for `timesheet.whitelynx.co.nz`
- Production SMTP on VM
- End-to-end email test with real mail server
- Docker service for Timesheet App in production stack

## Restore / run from this save point

### SupaDupaBase

```bash
cd "E:/White Lynx Projects/Cursor/supadupabase"
npm install && npm run build
cp .env.example .env
# Set ADMIN_EMAILS, AUTH_SECRET, and SMTP_* for submit testing
docker compose -f infra/docker-compose.dev.yml up -d
npm run migrate
npm run dev
```

### Timesheet App

```bash
cd "E:/White Lynx Projects/Work Stuff/Timeshhet App"
npm install
npm run dev
```

Open http://localhost:5180

## File map (Timesheet App)

| File | Purpose |
|------|---------|
| `index.html` | App shell, auth + week UI + settings |
| `app.js` | Auth, CRUD, submit, week navigation |
| `hours.js` | Overtime / paid-hours calculator |
| `styles.css` | Cyan Hexagons theme (SupaDupaBase style) |
| `manifest.webmanifest` | PWA install metadata |
| `sw.js` | Offline app shell cache |
| `src/server.ts` | Static file server (:5180) |

## File map (SupaDupaBase changes)

| File | Purpose |
|------|---------|
| `packages/db/migrations/002_timesheet.sql` | Schema + RLS |
| `apps/data-api/src/config.ts` | Table whitelist |
| `apps/mail-service/` | Weekly email submit service |
| `infra/Caddyfile` | `/mail/*` route |
| `infra/docker-compose.yml` | mail-service container |

## Overtime formula (v1)

```
worked       = max(0, (finish - start) - 0.5)
day_rate     = Mon–Fri 1.0 | Sat 1.5 | Sun 2.0
regular      = min(worked, 8)
daily_ot     = max(0, worked - 8)
paid_regular = regular × day_rate
paid_ot      = daily_ot × day_rate × 1.5
total_paid   = paid_regular + paid_ot
```

## Last updated

2026-06-28
