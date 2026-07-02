# Save point — v0.4.0-production

**Date:** 2026-07-02  
**Git commit:** `369f891` (main)  
**Repository:** https://github.com/johngoodspeed77/timesheet-app  
**Branch:** `main`  
**Previous tag:** `v0.3.1-production`

## Milestone summary

**Production live on VM101.** Dirty Save UI, quarter-hour time selects (iPhone PWA), and **work schedule settings** (part-time / custom work days) deployed. Backend migration `010_work_schedule.sql` applied on VM106.

## Production (live)

| Item | Value |
|------|--------|
| Public URL | https://timesheet.whitelynx.co.nz |
| Git commit | `369f891` |
| VM | `johngoodspeed@192.168.1.19` (VM101) |
| Deploy path | `/opt/timesheet-app` |
| Backend | https://supadupabase.whitelynx.co.nz (VM106) |

### Cache versions (live)

| Asset | Version |
|-------|---------|
| `app.js` | `?v=32` |
| `hours.js` | `?v=31` |
| `styles.css` | `?v=17` |
| `sw.js` | `?v=33` (`timesheet-app-v33`) |

## What shipped since v0.3.1-production

| Commit | Summary |
|--------|---------|
| `4a8329d` | Save only when row dirty; Delete removed |
| `8766500` | Quarter-hour `<select>` time pickers (iOS PWA) |
| `db2530a` | Work schedule in Settings (`work_days`, `shift_hours`) |
| `369f891` | Full-time default copy: Mon–Fri, 40 h/week, 08:00 start |

### Daily row UX

- Save **hidden** until row differs from saved baseline
- Save on the right (former Delete position)
- Quarter-hour dropdowns for start/finish (not native `input type=time`)

### Work schedule (Settings)

- **Default:** Mon–Fri, 8 h/day (40 h/week), 08:00 start → 16:30 finish (incl. 30 min lunch)
- Presets: Full-time, Part-time 4 days, Part-time 3 days
- Work-day checkboxes + hours/day selector
- Live preview; auto-fill respects schedule

### Remote deploy (VM101)

| Check | Result |
|-------|--------|
| `GET /hooks/healthz` | ✅ **200** |
| `POST /hooks/deploy` (no token) | ✅ **401** |
| PWA assets | ✅ `app.js?v=32` |

## Deploy

```bash
ssh johngoodspeed@192.168.1.19
cd /opt/timesheet-app && git pull origin main
chmod +x infra/deploy-quick.sh && bash infra/deploy-quick.sh
```

Or from dev PC (with `.env.remote`): `node scripts/remote-deploy.mjs --target timesheet` in supadupabase repo.

## Not done / follow-up

- Per-day different start/finish times (v2 advanced schedule)
- Leave credits tied to `shift_hours` (still 8 h full / 4 h half)
- Data API date-range filters; integration tests; license
- Optional: banner when `boss_email` empty

## Last updated

2026-07-02 — v0.4.0-production: dirty Save, quarter-hour picks, work schedule live (`369f891`).
