# Save point — v0.2.0-production

**Date:** 2026-06-29  
**Git tag:** `v0.2.0-production`  
**Repository:** https://github.com/johngoodspeed77/timesheet-app  
**Branch:** `main`

## Milestone summary

**Production PWA is live** on VM101 at https://timesheet.whitelynx.co.nz, backed by SupaDupaBase on VM106 (Option B). Invite-only sign-in, inline day editing, persistent login, and week submit are working. Service worker **v20**.

## Production (live)

| Item | Value |
|------|--------|
| Public URL | https://timesheet.whitelynx.co.nz |
| VM | `johngoodspeed@192.168.1.19` (VM101) |
| Deploy path | `/opt/timesheet-app` |
| Backend | https://supadupabase.whitelynx.co.nz (VM106) |
| Auth mode | **Invite-only** — no public sign-up; admin invites via SupaDupaBase |

**Redeploy after code changes on VM101:**

```bash
cd /opt/timesheet-app
git pull
DOCKER_BUILDKIT=0 docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

## What works

- Email/password sign-in (invited users only)
- Admin invite acceptance (`?invite_token=…`)
- Persistent login (`lib/session.js` — localStorage + refresh)
- Mon–Fri auto-fill from default start (8:00 → 16:30 clock, 8 h worked after lunch)
- Inline per-day editing (start/finish, Save/Delete on each row)
- 15-minute quarter-hour time steps (iOS-friendly)
- Week navigation, totals, overtime display with lunch breakdown
- Settings: boss email, display name, default start, weekly reminder toggle
- Submit week → email boss + lock week (unlock available)
- **↻ Refresh** button on sign-in header — clears SW cache and reloads
- Hours regression tests (`npm test`)

## Key commits (v0.1.0 → this save point)

| Commit | Summary |
|--------|---------|
| `130f3c2` | Option B — PWA on VM101, API on VM106 |
| `d6f1be4` | Admin invite link acceptance |
| `37e8be0` | Inline day row editing |
| `b6dffc2` | Invite-only UI; null-safe messages |
| `2af6ebd` | Fix sign-in race (stale session restore) |
| `7c302a9` | Hard refresh button on sign-in |

## Cache versions (this save point)

| Asset | Version |
|-------|---------|
| `app.js` | `?v=20` |
| `sw.js` | `?v=20` (`timesheet-app-v20`) |
| `styles.css` | `?v=8` |

## Environment (VM101 `infra/.env`)

| Variable | Purpose |
|----------|---------|
| `SDB_PUBLIC_URL` | `https://supadupabase.whitelynx.co.nz` |
| `SDB_PROXY` | `0` — browser calls VM106 directly |
| `VAPID_PUBLIC_KEY` | Web Push subscribe (from VM106) |

## Troubleshooting

- **Sign-in appears dead:** Tap **↻ Refresh** on the sign-in page (clears service worker + caches).
- **Stale app after deploy:** Hard refresh or re-open PWA; SW uses network-first for JS/HTML.
- **Submit fails:** Check boss email in Settings and SMTP on VM106.

## Restore / run locally

```bash
git clone https://github.com/johngoodspeed77/timesheet-app.git
cd timesheet-app
git checkout v0.2.0-production
npm install
# Start SupaDupaBase locally first (see supadupabase README)
npm run dev
```

Open http://localhost:5180

## Not done / follow-up

- Google OAuth button removed from UI (invite-only); re-enable only if needed
- Data API date-range filters (client loads all user entries)
- Integration tests for submit flow and RLS
- License

## Last updated

2026-06-29
