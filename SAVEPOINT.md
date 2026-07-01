# Save point — v0.3.2-development

**Date:** 2026-07-01  
**Git commit:** `7dfd3f9` (main; UI in `4a8329d`)  
**Repository:** https://github.com/johngoodspeed77/timesheet-app  
**Branch:** `main`  
**Previous tag:** `v0.3.1-production`

## Milestone summary

**Code on GitHub; VM101 deploy pending.** Daily row UX: **Save only when dirty** (hidden until user edits mode, times, or leave fields); **Delete removed**. Remote deploy hook for VM101 (`deploy-hook` + `enable-remote-deploy.sh`). Production VM still on last deployed `v0.3.1-production` assets until home PC deploy.

## Production (live — last deployed)

| Item | Value |
|------|--------|
| Public URL | https://timesheet.whitelynx.co.nz |
| Last deployed | `v0.3.1-production` |
| VM | `johngoodspeed@192.168.1.19` (VM101) |
| Deploy path | `/opt/timesheet-app` |
| Backend | https://supadupabase.whitelynx.co.nz (VM106) |

## What’s new on `main` (not yet on VM101)

| Commit | Summary |
|--------|---------|
| `3344e7d` | Remove OAuth redirect URL handling (matches SupaDupaBase) |
| `7e5ff2a` | `deploy-hook` container + `deploy-quick.sh` |
| `4a8329d` | **Save when dirty**; remove per-day Delete; cache bump |
| `018bb4d` | `enable-remote-deploy.sh` + home deploy doc link |
| `82394be`–`7dfd3f9` | deploy-hook host user + **202 async** deploy |

### Remote deploy (VM101)

| Check | Result (2026-07-01) |
|-------|---------------------|
| `GET /hooks/healthz` | ✅ **200** — `enabled: true` |
| `POST /hooks/deploy` (no token) | ✅ **401** Unauthorized |
| PWA assets live | ❌ still `app.js?v=28`, `styles.css?v=13` |

### Daily row UX (`4a8329d`)

- Save button **hidden** until row differs from saved baseline
- Save positioned where Delete was (right side of row actions)
- Delete button and `deleteDayEntry` removed

### Cache versions (this release)

| Asset | Version |
|-------|---------|
| `app.js` | `?v=29` |
| `hours.js` | `?v=28` |
| `styles.css` | `?v=14` |
| `sw.js` | `?v=30` (`timesheet-app-v30`) |

## Deploy pending changes

**At home (LAN):**

```bash
ssh johngoodspeed@192.168.1.19
cd /opt/timesheet-app
git pull
chmod +x infra/deploy-quick.sh
DOCKER_BUILDKIT=0 docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build timesheet-app
```

See [SupaDupaBase HOME_PC_SETUP.md](https://github.com/johngoodspeed77/supadupabase/blob/main/infra/HOME_PC_SETUP.md).

**Remote deploy (after hook setup):**

```bash
# from supadupabase repo
node scripts/remote-deploy.mjs --target timesheet
```

## What still works (unchanged behaviour)

- Invite-only sign-in, work/day-off/leave rows, week submit, Fuzed Group email
- Mobile layout, ↻ Refresh, persistent session

## Not done / follow-up

- **Deploy `main` to VM101** (hook works — run remote deploy with secret)
- Fix VM106 deploy-hook (**502** on SupaDupaBase)
- Data API date-range filters
- Integration tests; license

## Last updated

2026-07-01 — Remote deploy check: VM101 hook OK; PWA still on v28 until deploy runs.
