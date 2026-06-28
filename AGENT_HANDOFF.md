# Timesheet App — Agent handoff

> **Read this first** when picking up work on this project. Update this file when major decisions or milestones change.

## Project summary

**Timesheet App** is a self-hosted PWA for multiple employees to log weekly hours and email a timesheet to their boss. It uses **SupaDupaBase** for auth, data storage (Postgres + RLS), and weekly email submission.

**Workspace folder:** `E:\White Lynx Projects\Work Stuff\Timeshhet App` (product name: **Timesheet App**)

**Backend repo:** `E:\White Lynx Projects\Cursor\supadupabase`

## Save point — v0.1.0-local-mvp

**Current stage:** Local dev MVP **complete**. Deploy-ready structure; VM + tunnel **not started**.

See [SAVEPOINT.md](./SAVEPOINT.md) for restore instructions.

### Completed

- [x] Vanilla JS PWA (auth, week view, day entry, settings, submit)
- [x] Hours calculator (`hours.js`) — lunch deduction, day rates, OT stacking
- [x] Service worker + web manifest (installable PWA shell)
- [x] SupaDupaBase migration `002_timesheet.sql` (tables + RLS + week lock)
- [x] Data API whitelist for timesheet tables
- [x] `mail-service` — `POST /mail/timesheet/submit`, SMTP, HTML email template
- [x] README, AGENT_HANDOFF, SAVEPOINT

### Not started / deferred

- [ ] Proxmox VM + Cloudflare Tunnel for `timesheet.whitelynx.co.nz`
- [ ] Production SMTP credentials on VM
- [ ] Google OAuth redirect for production origin
- [ ] Docker compose service for Timesheet App on VM
- [ ] Data API date-range filters (`gte`/`lte`) — currently client filters all entries
- [ ] Integration tests (RLS lock, submit flow)

## Confirmed decisions

| Topic | Decision |
|-------|----------|
| Product name | **Timesheet App** |
| Backend | SupaDupaBase (self-hosted) |
| Users | Multiple — each logs in with own email |
| Work week | Monday–Sunday |
| Daily entry | One start/finish; 30 min lunch auto-deducted |
| Overtime | >8h/day; Sat 1.5×, Sun 2×; OT premium stacks (×1.5 on top of day rate) |
| Boss email | Per user in Settings |
| Week submit | Sends email then **locks** week (no edits) |
| Hosting | `timesheet.whitelynx.co.nz` via Cloudflare Tunnel → Proxmox VM |
| UI stack | Vanilla HTML/CSS/JS — no React (matches SupaDupaBase sample PWA) |

## Architecture

```
Timesheet App (PWA :5180)
  → SupaDupaBase auth-service   /auth/*
  → SupaDupaBase data-api       /rest/v1/{user_settings,time_entries,week_submissions}
  → SupaDupaBase mail-service   /mail/timesheet/submit
```

## Database tables (SupaDupaBase)

| Table | Purpose |
|-------|---------|
| `user_settings` | `boss_email`, `employee_name` per user |
| `time_entries` | One row per user per day (start/end times, notes) |
| `week_submissions` | Lock record after email sent |

RLS uses `public.is_week_locked()` to block entry changes on submitted weeks.

## Mail service contract

```
POST /mail/timesheet/submit
Authorization: Bearer <access_token>
Body: { "week_start": "YYYY-MM-DD" }   // must be a Monday

200: { ok: true, email_sent_to, submitted_at }
409: week already submitted
400: no boss email / no entries
503: SMTP not configured
```

SMTP env vars on SupaDupaBase: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`.

## Local dev checklist

```bash
# Terminal 1 — SupaDupaBase
cd ../Cursor/supadupabase
docker compose -f infra/docker-compose.dev.yml up -d
npm run migrate
npm run dev

# Terminal 2 — Timesheet App
cd "E:/White Lynx Projects/Work Stuff/Timeshhet App"
npm install && npm run dev
```

## Next work (recommended order)

1. Configure SMTP in SupaDupaBase `.env` and test submit locally
2. Provision Proxmox VM; deploy SupaDupaBase ([infra/DEPLOY_AT_HOME.md](../Cursor/supadupabase/infra/DEPLOY_AT_HOME.md))
3. Add Timesheet App Docker service + Cloudflare hostname
4. Google OAuth production redirect for `https://timesheet.whitelynx.co.nz`
5. RLS + submit integration tests

## Related docs

- [README.md](./README.md)
- [SAVEPOINT.md](./SAVEPOINT.md)
- [SupaDupaBase AGENT_HANDOFF.md](../Cursor/supadupabase/AGENT_HANDOFF.md)

## Last updated

2026-06-28 — Save point v0.1.0-local-mvp; initial build complete.
