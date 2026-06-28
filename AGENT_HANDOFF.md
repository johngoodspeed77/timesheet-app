# Timesheet App — Agent handoff

> **Read this first** when picking up work on this project. Update this file when major decisions or milestones change.

## Project summary

**Timesheet App** is a self-hosted PWA for multiple employees to log weekly hours and email a timesheet to their boss. It uses **SupaDupaBase** for auth, data storage (Postgres + RLS), and weekly email submission.

**Workspace folder:** `E:\White Lynx Projects\Work Stuff\Timeshhet App`

**Backend repo:** `E:\White Lynx Projects\Cursor\supadupabase` · GitHub: `johngoodspeed77/supadupabase`

**GitHub (this repo):** `johngoodspeed77/timesheet-app`

## Current stage — VM101 LAN deploy (2026-06-28)

**Live on LAN:** http://192.168.1.19:5180 (Proxmox VM101, user `johngoodspeed`)

SupaDupaBase stack runs on the same VM (`192.168.1.19:80` via Caddy). Timesheet App Docker container joins `infra_sdb` network and **proxies** `/auth/*`, `/rest/*`, `/mail/*` so the browser uses same-origin requests.

### Completed since v0.1.0-local-mvp

- [x] VM101 deployment — [infra/DEPLOY_VM101.md](./infra/DEPLOY_VM101.md), `infra/docker-compose.yml`, `src/server.ts` proxy
- [x] Same-origin config via `infra/entrypoint.sh` (empty `__SDB_*_URL` → `window.location.origin`)
- [x] Default shift: **8:00 AM start**, finish **16:30** on clock (8 h worked after 30 min lunch)
- [x] **Mon–Fri auto-fill** for current week (`ensureDefaultWeekdayEntries` in `app.js`); Sat/Sun manual
- [x] Mobile-responsive CSS (safe areas, 44px tap targets, stacked toolbar/day rows)
- [x] Weekly reminder — client `reminders.js`, SW push handlers, Settings checkbox
- [x] SupaDupaBase migrations `005_weekly_reminders.sql`, `006_default_start_8am.sql`
- [x] Mail-service push routes + `infra/send-weekly-reminders.sh` cron (Sunday 3pm NZ)
- [x] VAPID keys on VM101; cron scheduled
- [x] Auth UX fixes — explicit login errors, session restore `.catch()`, signup duplicate-email message
- [x] Service worker v10 — network-first for JS/HTML; push notification handlers
- [x] **Login fix (2026-06-28):** duplicate `const end` in `updateWeekUI()` caused `SyntaxError` — entire `app.js` failed to load; Sign in appeared dead with no error. Fixed → renamed `weekEnd` / `shiftEnd`.

### Verified working (VM101)

- Sign up / sign in (email/password)
- Load week, auto-fill Mon–Fri, edit/save days
- E2E test user: `e2e-test@whitelynx.test` / `E2eTestPass123!`
- Real user exists: `jesse@fuzedgroup.com` (use Sign in, not Sign up)

### Not done / follow-up

- [ ] **Cloudflare Tunnel** — `timesheet.whitelynx.co.nz` → `http://192.168.1.19:5180`
- [ ] **Production SMTP** — confirm week submit email with real mail server on VM
- [ ] **Google OAuth** production redirect for public timesheet URL
- [ ] **RLS audit** — earlier testing saw `time_entries` GET returning all users' rows in some cases; client does not filter by `user_id`. Verify/fix in data-api.
- [ ] **Data API date-range filters** — client still loads all entries
- [ ] Integration tests (RLS lock, submit flow, auto-fill)
- [ ] Commit/push SupaDupaBase side changes if not already on GitHub
- [ ] Tag release after public URL works

## Confirmed decisions

| Topic | Decision |
|-------|----------|
| Product name | **Timesheet App** |
| Backend | SupaDupaBase (self-hosted) |
| Users | Multiple — each logs in with own email |
| Work week | Monday–Sunday |
| Default week | Mon–Fri auto-fill: 8:00 start, 16:30 finish clock, 40 h worked/week |
| Daily entry | One start/finish; 30 min lunch auto-deducted |
| Overtime | >8h/day; Sat 1.5×, Sun 2×; OT premium stacks (×1.5 on top of day rate) |
| Boss email | Per user in Settings |
| Week submit | Sends email then **locks** week (unlock button available) |
| Hosting | VM101 LAN now; `timesheet.whitelynx.co.nz` via Cloudflare Tunnel planned |
| UI stack | Vanilla HTML/CSS/JS — no React |
| VM deploy | `DOCKER_BUILDKIT=0` required on VM101 |

## Architecture

```
Browser → Timesheet App (PWA :5180)
            ├─ proxy /auth/*  → auth-service:3001
            ├─ proxy /rest/*  → data-api:3002
            └─ proxy /mail/*  → mail-service:3004
         (Docker network: infra_sdb)
```

Local dev: browser talks directly to `:3001/:3002/:3004` via `config.js`.

## Key files

| File | Purpose |
|------|---------|
| `app.js` | Main UI, auth, auto-fill, submit |
| `hours.js` | Time math, `defaultShiftTimes`, `weekdayDatesInWeek` |
| `reminders.js` | Push subscribe + local Sunday reminder fallback |
| `sw.js` | Cache v10, network-first JS, push handlers |
| `src/server.ts` | Static files + SupaDupaBase reverse proxy |
| `infra/docker-compose.yml` | VM service; joins external `infra_sdb` network |
| `infra/entrypoint.sh` | Generates `config.js` with VAPID + API URLs |

## Database (SupaDupaBase)

| Table | Purpose |
|-------|---------|
| `user_settings` | `boss_email`, `employee_name`, `default_start_time`, `weekly_reminder_enabled` |
| `time_entries` | One row per user per day |
| `week_submissions` | Lock after email sent |
| `push_subscriptions` | Web push endpoints for reminders |

## VM101 ops cheat sheet

```bash
# SSH
ssh johngoodspeed@192.168.1.19

# Rebuild timesheet after git pull or scp
cd /opt/timesheet-app
DOCKER_BUILDKIT=0 docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build timesheet-app

# SupaDupaBase migrations
cd /opt/supadupabase
DOCKER_SUDO=1 bash infra/migrate.sh

# Health
curl http://192.168.1.19/auth/healthz
curl http://192.168.1.19:5180/
```

## Next work (recommended order)

1. **User validation** — Jesse confirms login + auto-fill on desktop after hard refresh (Ctrl+Shift+R)
2. **RLS** — confirm `time_entries` SELECT is scoped to `auth.uid()` in data-api; add client-side `user_id` filter as defense
3. **SMTP** — test week submit email end-to-end on VM
4. **Cloudflare Tunnel** — public hostname for timesheet + update `SDB_PUBLIC_URL` / OAuth redirects
5. **SupaDupaBase repo** — ensure migrations 005/006 and mail push code are committed and deployed consistently

## Related docs

- [README.md](./README.md)
- [SAVEPOINT.md](./SAVEPOINT.md) *(still describes v0.1.0-local-mvp — update when tagging next release)*
- [infra/DEPLOY_VM101.md](./infra/DEPLOY_VM101.md)
- [SupaDupaBase AGENT_HANDOFF.md](../Cursor/supadupabase/AGENT_HANDOFF.md)

## Last updated

2026-06-28 — VM101 LAN deploy; Mon–Fri auto-fill; weekly reminders; login syntax fix deployed. Pick up: public URL, SMTP e2e, RLS audit.
