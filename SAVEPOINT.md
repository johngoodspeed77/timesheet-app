# Save point — v0.3.2-development

**Date:** 2026-07-01  
**Git commit:** `b5168b9` (main; UI in `4a8329d`)  
**Repository:** https://github.com/johngoodspeed77/timesheet-app  
**Branch:** `main`  
**Previous tag:** `v0.3.1-production`

## Milestone summary

**All code on GitHub — VM101 deploy pending (owner deploying at home).** Daily row UX: **Save only when dirty**; **Delete removed**. Remote deploy hook on VM101 verified working; PWA assets not yet updated on production.

## Next action (owner)

Follow [SupaDupaBase HOME_PC_SETUP.md — Quick checklist](https://github.com/johngoodspeed77/supadupabase/blob/main/infra/HOME_PC_SETUP.md#quick-checklist--run-when-you-get-home) step 4 (VM101 deploy).

After deploy, confirm `app.js?v=29`, no Delete button, Save appears only after edits.

## Production (live — last deployed)

| Item | Value |
|------|--------|
| Public URL | https://timesheet.whitelynx.co.nz |
| Last deployed | `v0.3.1-production` |
| Live assets | `app.js?v=28`, `styles.css?v=13` (pre-dirty-Save UI) |
| VM | `johngoodspeed@192.168.1.19` (VM101) |
| Deploy path | `/opt/timesheet-app` |
| Backend | https://supadupabase.whitelynx.co.nz (VM106) |

## What’s on `main` (pending VM101 deploy)

| Commit | Summary |
|--------|---------|
| `4a8329d` | **Save when dirty**; remove Delete; cache bump |
| `7e5ff2a` | `deploy-hook` + `deploy-quick.sh` |
| `82394be`–`7dfd3f9` | deploy-hook host user + **202 async** |
| `c9759d5` | Remote deploy status docs |
| `b5168b9` | README link to home deploy checklist |

### Remote deploy (VM101) — 2026-07-01

| Check | Result |
|-------|--------|
| `GET /hooks/healthz` | ✅ **200** `enabled: true` |
| `POST /hooks/deploy` (no token) | ✅ **401** |
| PWA assets live | ❌ still v28 / v13 |

### Daily row UX (`4a8329d`)

- Save **hidden** until row differs from saved baseline
- Save on the right (former Delete position)
- Delete button removed

### Cache versions (after deploy)

| Asset | Version |
|-------|---------|
| `app.js` | `?v=29` |
| `hours.js` | `?v=28` |
| `styles.css` | `?v=14` |
| `sw.js` | `?v=30` (`timesheet-app-v30`) |

## Deploy at home

```bash
ssh johngoodspeed@192.168.1.19
cd /opt/timesheet-app && git pull origin main
chmod +x infra/deploy-quick.sh
DOCKER_BUILDKIT=0 docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build timesheet-app
```

Or remote (with secret): `node scripts/remote-deploy.mjs --target timesheet` from supadupabase repo.

## Not done / follow-up

- Deploy `main` to VM101 (blocked on owner home session)
- Fix VM106 deploy-hook (502) — see supadupabase checklist
- Data API date-range filters; integration tests; license

## Last updated

2026-07-01 — Save point synced; home deploy pending (`b5168b9`).
