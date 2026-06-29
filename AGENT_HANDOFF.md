# Timesheet App — Agent handoff

> **Read this first** when picking up work on this project. Update this file when major decisions or milestones change.

## Project summary

**Timesheet App** is a self-hosted PWA for multiple employees to log weekly hours and email a timesheet to their boss. It uses **SupaDupaBase** for auth, data storage (Postgres + RLS), and weekly email submission.

**Workspace folder:** `E:\White Lynx Projects\Work Stuff\Timeshhet App`  
**Cursor (both repos):** `E:\White Lynx Projects\Cursor\whitelynx.code-workspace`

**Backend repo:** `E:\White Lynx Projects\Cursor\supadupabase` · GitHub: `johngoodspeed77/supadupabase`

**GitHub (this repo):** `johngoodspeed77/timesheet-app`

## Current stage — v0.2.0-production (2026-06-29)

**Timesheet (VM101):** https://timesheet.whitelynx.co.nz · deploy `/opt/timesheet-app`  
**SupaDupaBase (VM106):** https://supadupabase.whitelynx.co.nz · `supadupabase@192.168.1.112`

Browser loads PWA from VM101; auth/data/mail call VM106 directly (`SDB_PROXY=0`).  
**Auth:** invite-only (no public sign-up UI; `INVITE_ONLY=1` on VM106).  
**Save point:** `v0.2.0-production` · SW **v20** · `app.js?v=20`

### Completed since v0.1.0-local-mvp

- [x] **Option B** — Timesheet VM101 + SupaDupaBase VM106; `config.js` → `https://supadupabase.whitelynx.co.nz`
- [x] Cloudflare tunnel — `timesheet.whitelynx.co.nz`
- [x] Persistent login — `lib/session.js` (localStorage + refresh)
- [x] Default shift: **8:00 AM start**, finish **16:30** on clock (8 h worked after 30 min lunch)
- [x] **Mon–Fri auto-fill**; **inline row editing** (Save/Delete per day)
- [x] Quarter-hour time steps (`step="900"`) for iOS
- [x] Mobile-responsive CSS; black background; toolbar/footer layout
- [x] Weekly reminder client + SW push handlers
- [x] Admin invite acceptance (`?invite_token=`)
- [x] **Invite-only UI** — sign-up + Google button removed
- [x] **Login race fix** — fresh login no longer cleared by stale session restore
- [x] **↻ Refresh** button on sign-in — clears SW cache
- [x] Hours regression tests (`npm test`)
- [x] Service worker network-first for JS/HTML (v20)

### Verified working (production)

- Sign in (invited users), persistent session restore
- Load week, auto-fill Mon–Fri, inline edit/save days, submit week
- Real user: `jesse@fuzedgroup.com`

### Not done / follow-up

- [ ] **Data API date-range filters** — client loads all user entries
- [ ] **Google OAuth** — optional; removed from UI while invite-only
- [ ] Integration tests (RLS lock, submit flow)
- [ ] License

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
| Hosting | VM101 PWA; backend VM106 (`supadupabase.whitelynx.co.nz`) |
| UI stack | Vanilla HTML/CSS/JS — no React |
| VM deploy | `DOCKER_BUILDKIT=0` required on VM101 |

## Architecture (Option B)

```
Browser @ timesheet.whitelynx.co.nz (VM101 :5180)
    → https://supadupabase.whitelynx.co.nz/auth|rest|mail (VM106)
```

Local dev: Timesheet `:5180` → `localhost:3001/3002/3004` via `config.js`.

## Key files

| File | Purpose |
|------|---------|
| `app.js` | Main UI, auth, auto-fill, submit |
| `hours.js` | Time math, `defaultShiftTimes`, `weekdayDatesInWeek` |
| `reminders.js` | Push subscribe + local Sunday reminder fallback |
| `sw.js` | Cache v10, network-first JS, push handlers |
| `lib/session.js` | Persistent auth (localStorage + refresh) |
| `src/server.ts` | Static files; optional API proxy when `SDB_PROXY=1` |
| `infra/docker-compose.yml` | VM101 — Timesheet only (no `infra_sdb`) |
| `infra/entrypoint.sh` | Generates `config.js` with VM106 backend URL |

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

1. **Cloudflare** — add `timesheet.whitelynx.co.nz` public hostname on tunnel (DEPLOY_VM101.md §3)
2. **User validation** — Jesse confirms login + auto-fill on desktop (hard refresh Ctrl+Shift+R)
3. **Google OAuth** — add `https://timesheet.whitelynx.co.nz` redirect when public URL is live
4. **SupaDupaBase repo** — commit/push data-api user scoping; refresh `TUNNEL_TOKEN` on VM if cloudflared should run locally
5. **Data API** — optional date-range filters to reduce payload size

## Related docs

- [README.md](./README.md)
- [SAVEPOINT.md](./SAVEPOINT.md) *(still describes v0.1.0-local-mvp — update when tagging next release)*
- [infra/DEPLOY_VM101.md](./infra/DEPLOY_VM101.md)
- [SupaDupaBase docs/STACK.md](../../Cursor/supadupabase/docs/STACK.md)
- [SupaDupaBase AGENT_HANDOFF.md](../../Cursor/supadupabase/AGENT_HANDOFF.md)

## Last updated

2026-06-29 — Proxy + RLS fixes deployed; SMTP submit verified; cloudflared docs updated. Pick up: timesheet public hostname.
