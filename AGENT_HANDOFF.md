# Timesheet App — Agent handoff

> **Read this first** when picking up work on this project. Update this file when major decisions or milestones change.

## Project summary

**Timesheet App** is a self-hosted PWA for multiple employees to log weekly hours and email a timesheet to their boss. It uses **SupaDupaBase** for auth, data storage (Postgres + RLS), and weekly email submission.

**Workspace folder:** `E:\White Lynx Projects\Work Stuff\Timeshhet App`  
**Cursor (both repos):** `E:\White Lynx Projects\Cursor\whitelynx.code-workspace`

**Backend repo:** `E:\White Lynx Projects\Cursor\supadupabase` · GitHub: `johngoodspeed77/supadupabase`

**GitHub (this repo):** `johngoodspeed77/timesheet-app`

## Current stage — v0.3.0-production (2026-06-30)

**Timesheet (VM101):** https://timesheet.whitelynx.co.nz · deploy `/opt/timesheet-app`  
**SupaDupaBase (VM106):** https://supadupabase.whitelynx.co.nz · `supadupabase@192.168.1.112`

Browser loads PWA from VM101; auth/data/mail call VM106 directly (`SDB_PROXY=0`).  
**Auth:** invite-only (no public sign-up UI; `INVITE_ONLY=1` on VM106).  
**Save point:** `v0.3.0-production` · SW **v29** · `app.js?v=28` · `hours.js?v=28` · `styles.css?v=13`

### Completed since v0.2.0-production

- [x] **Leave types** — work / day off / leave per row; paid leave (8h full / 4h AM·PM); migration `009_leave_entries.sql` on VM106
- [x] **Day off** as top-level row mode (not under leave dropdown); Sat–Sun default Day off; Mon–Fri default Work
- [x] **Weekend rows** blank until user enters times (no auto 8h on Sat/Sun)
- [x] **Sign-in fixes** — session-restore race (`enterAppGeneration`, token snapshot in `lib/session.js`); cache-bust `hours.js?v=28`; removed fragile disabled submit gate
- [x] **OT display** — `8.00h + 0.50h OT` (not combined total)
- [x] **Time inputs** — native clock picker icon hidden (handwritten-style fields only)
- [x] **Mobile layout pass** — full-width Send button, stacked day rows, 375px/320px verified
- [x] Removed **paid equivalent** from week totals
- [x] Hours tests extended (`rowModeForEntry`, `leaveTypesForSelect`)

### Verified working (production)

- Sign in (invited users), persistent session restore
- Load week, auto-fill Mon–Fri, inline edit/save days, day off / leave rows, submit week
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
| Default week | Mon–Fri Work (8:00–16:30, 40 h worked); Sat–Sun Day off |
| Row modes | **Work** · **Day off** · **Leave** (leave sub-types exclude day off) |
| Daily entry | Work: start/finish + 30 min lunch; Leave: type + duration |
| Overtime | >8h/day; Sat 1.5×, Sun 2×; display as 8h + OT hours |
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
| `app.js` | Main UI, auth, row modes, auto-fill, submit |
| `hours.js` | Time/leave math, `rowModeForEntry`, `defaultRowModeForDate` |
| `reminders.js` | Push subscribe + local Sunday reminder fallback |
| `sw.js` | Cache v29, network-first JS/HTML, push handlers |
| `lib/session.js` | Persistent auth + restore race guard (`clearTokensIfUnchanged`) |
| `styles.css` | Cyan Hexagons theme; mobile breakpoints 640px / 380px |
| `src/server.ts` | Static files; optional API proxy when `SDB_PROXY=1` |
| `infra/docker-compose.yml` | VM101 — Timesheet only (no `infra_sdb`) |
| `infra/entrypoint.sh` | Generates `config.js` with VM106 backend URL |

## Database (SupaDupaBase)

| Table | Purpose |
|-------|---------|
| `user_settings` | `boss_email`, `employee_name`, `default_start_time`, `weekly_reminder_enabled` |
| `time_entries` | Per user per day: `entry_type` work/leave, `leave_type`, `leave_duration`, times |
| `week_submissions` | Lock after email sent |
| `push_subscriptions` | Web push endpoints for reminders |

## VM101 ops cheat sheet

```bash
# SSH
ssh johngoodspeed@192.168.1.19

# Rebuild timesheet after git pull
cd /opt/timesheet-app
git pull
DOCKER_BUILDKIT=0 docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build

# Health
curl http://192.168.1.19:5180/
curl -s https://timesheet.whitelynx.co.nz/ | head
```

## Next work (recommended order)

1. **Data API** — optional date-range filters to reduce payload size
2. **Integration tests** — submit flow, RLS week lock, leave row shapes
3. **License** — pick SPDX or proprietary

## Related docs

- [README.md](./README.md)
- [SAVEPOINT.md](./SAVEPOINT.md)
- [infra/DEPLOY_VM101.md](./infra/DEPLOY_VM101.md)
- [SupaDupaBase docs/STACK.md](../../Cursor/supadupabase/docs/STACK.md)
- [SupaDupaBase AGENT_HANDOFF.md](../../Cursor/supadupabase/AGENT_HANDOFF.md)

## Last updated

2026-06-30 — v0.3.0-production: leave/day-off rows, sign-in cache fixes, mobile CSS, deployed VM101.
