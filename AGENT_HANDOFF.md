# Timesheet App — Agent handoff

> **Read this first** when picking up work on this project. Update this file when major decisions or milestones change.

## Project summary

**Timesheet App** is a self-hosted PWA for multiple employees to log weekly hours and email a timesheet to their boss. It uses **SupaDupaBase** for auth, data storage (Postgres + RLS), and weekly email submission.

**Workspace folder:** `E:\White Lynx Projects\Work Stuff\Timeshhet App`  
**Cursor (both repos):** `E:\White Lynx Projects\Cursor\whitelynx.code-workspace`

**Backend repo:** `johngoodspeed77/supadupabase`  
**GitHub (this repo):** `johngoodspeed77/timesheet-app`

## Current stage — v0.3.2-development (2026-06-27)

**Timesheet (VM101):** https://timesheet.whitelynx.co.nz · last deployed `v0.3.1-production` · **`main` pending deploy**  
**SupaDupaBase (VM106):** https://supadupabase.whitelynx.co.nz · `v0.3.0-development` on GitHub (`2ee9aae`)

Browser loads PWA from VM101; auth/data/mail call VM106 (`SDB_PROXY=0`).  
**Auth:** invite-only email/password (`INVITE_ONLY=1` on VM106).  
**Save point:** `v0.3.2-development` · SW **v30** · `app.js?v=29` · `styles.css?v=14`

### Completed since v0.3.1-production

- [x] **Dirty Save UI** — Save only when row changed; Delete removed (`4a8329d`)
- [x] **Remote deploy hook** — `deploy-hook`, `deploy-quick.sh`, `enable-remote-deploy.sh` (`7e5ff2a`, `018bb4d`)
- [x] OAuth redirect handling removed (`3344e7d`)

### Completed (earlier)

- [x] Work / day off / leave rows; mobile layout; sign-in fixes; Fuzed Group boss email
- [x] Hours tests (`npm test`)

### Not done / follow-up

- [ ] **Deploy `main` to VM101** — remote hook works; run with `DEPLOY_HOOK_SECRET`
- [ ] Fix VM106 SupaDupaBase deploy-hook (502)
- [ ] Data API date-range filters
- [ ] Integration tests; license

## Confirmed decisions

| Topic | Decision |
|-------|----------|
| Daily save UX | Save appears only when row is **dirty**; no per-day Delete |
| Auth | Invite-only email/password (no Google OAuth) |
| Hosting | VM101 PWA; backend VM106 |
| VM deploy | `DOCKER_BUILDKIT=0` on VM101 |

## Key files

| File | Purpose |
|------|---------|
| `app.js` | UI, dirty-state Save, row modes, submit |
| `hours.js` | Time/leave math |
| `lib/session.js` | Persistent auth |
| `sw.js` | Cache v30 |
| `infra/enable-remote-deploy.sh` | One-time VM101 hook setup |
| `infra/deploy-quick.sh` | git pull + docker rebuild |

## VM101 ops

```bash
ssh johngoodspeed@192.168.1.19
cd /opt/timesheet-app && git pull && chmod +x infra/deploy-quick.sh
DOCKER_BUILDKIT=0 docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build timesheet-app
```

## Next work

1. Home PC deploy (section A in HOME_PC_SETUP.md)
2. Remote hook setup (section B)
3. Data API date filters

## Related docs

- [README.md](./README.md)
- [SAVEPOINT.md](./SAVEPOINT.md)
- [infra/DEPLOY_VM101.md](./infra/DEPLOY_VM101.md)
- [SupaDupaBase HOME_PC_SETUP.md](https://github.com/johngoodspeed77/supadupabase/blob/main/infra/HOME_PC_SETUP.md)

## Last updated

2026-07-01 — Remote deploy check: VM101 hook OK; PWA deploy pending.
