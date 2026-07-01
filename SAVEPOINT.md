# Save point — v0.3.2-development

**Date:** 2026-06-27  
**Git commit:** `018bb4d` (main; UI in `4a8329d`)  
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

- Deploy `main` to VM101
- Remote hook + Cloudflare `/hooks/*` → port 5189
- Data API date-range filters
- Integration tests; license

## Last updated

2026-06-27 — Save point v0.3.2-development: dirty Save UI, remote deploy hook (`4a8329d`, `018bb4d`).
