# Timesheet App — Agent handoff

> **Read this first** when picking up work on this project. Update this file when major decisions or milestones change.

## Project summary

**Timesheet App** is a self-hosted PWA for multiple employees to log weekly hours and email a timesheet to their boss. It uses **SupaDupaBase** for auth, data storage (Postgres + RLS), and weekly email submission.

**Workspace folder:** `E:\White Lynx Projects\Work Stuff\Timeshhet App`  
**Cursor (both repos):** `E:\White Lynx Projects\Cursor\whitelynx.code-workspace`

**Backend repo:** `johngoodspeed77/supadupabase`  
**GitHub (this repo):** `johngoodspeed77/timesheet-app`

## Current stage — v0.4.0-production (2026-07-02)

**Timesheet (VM101):** https://timesheet.whitelynx.co.nz · **`main` at `369f891`** · deployed  
**SupaDupaBase (VM106):** https://supadupabase.whitelynx.co.nz · migration `010` applied

Browser loads PWA from VM101; auth/data/mail call VM106 (`SDB_PROXY=0`).  
**Auth:** invite-only email/password (`INVITE_ONLY=1` on VM106).  
**Save point:** `v0.4.0-production` · SW **v33** · `app.js?v=32` · `hours.js?v=31` · `styles.css?v=17`

### Completed since v0.3.1-production

- [x] **Dirty Save UI** — Save only when row changed; Delete removed (`4a8329d`)
- [x] **Quarter-hour time selects** — iOS PWA-friendly 15 min steps (`8766500`)
- [x] **Work schedule settings** — work days, hours/day, presets; default Mon–Fri 40 h @ 08:00 (`db2530a`, `369f891`)
- [x] **Remote deploy hook** — VM101 verified; SSH + webhook deploy (`7e5ff2a`)
- [x] OAuth redirect handling removed (`3344e7d`)

### Completed (earlier)

- [x] Work / day off / leave rows; mobile layout; sign-in fixes; Fuzed Group boss email
- [x] Hours tests (`npm test`)

### Not done / follow-up

- [ ] Per-day different start/finish times (advanced schedule v2)
- [ ] Leave hour credits scaled to `shift_hours`
- [ ] Data API date-range filters
- [ ] Integration tests; license
- [ ] Optional setup banner when `boss_email` empty

## Confirmed decisions

| Topic | Decision |
|-------|----------|
| Daily save UX | Save appears only when row is **dirty**; no per-day Delete |
| Time entry | Quarter-hour `<select>` (not native time input on mobile) |
| Work schedule | Settings (not first-login wizard); default full-time Mon–Fri 8 h @ 08:00 |
| Auth | Invite-only email/password (no Google OAuth) |
| Hosting | VM101 PWA; backend VM106 |
| VM deploy | `DOCKER_BUILDKIT=0` on VM101 |

## Key files

| File | Purpose |
|------|---------|
| `app.js` | UI, dirty-state Save, work schedule settings, row modes |
| `hours.js` | Time/leave math, `workDatesInWeek`, `typicalWeekSummary` |
| `lib/session.js` | Persistent auth |
| `sw.js` | Cache v33 |
| `infra/enable-remote-deploy.sh` | One-time VM101 hook setup |
| `infra/deploy-quick.sh` | git pull + docker rebuild |

## VM101 ops

```bash
ssh johngoodspeed@192.168.1.19
cd /opt/timesheet-app && git pull && chmod +x infra/deploy-quick.sh
bash infra/deploy-quick.sh
```

## Next work

1. Per-day schedule v2 (optional)
2. Leave credits tied to part-time `shift_hours`
3. Data API date filters; integration tests; license

## Related docs

- [README.md](./README.md)
- [SAVEPOINT.md](./SAVEPOINT.md)
- [infra/DEPLOY_VM101.md](./infra/DEPLOY_VM101.md)
- [SupaDupaBase HOME_PC_SETUP.md](https://github.com/johngoodspeed77/supadupabase/blob/main/infra/HOME_PC_SETUP.md)

## Last updated

2026-07-02 — v0.4.0-production: dirty Save, quarter-hour picks, work schedule live (`369f891`).
