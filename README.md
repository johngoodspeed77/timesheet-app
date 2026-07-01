# Timesheet App

Weekly timesheet PWA — log start/finish times Mon–Sun, track overtime and leave, and email your boss at week end. Built on [SupaDupaBase](https://github.com/johngoodspeed77/supadupabase).

**Repository:** https://github.com/johngoodspeed77/timesheet-app

**Production:** https://timesheet.whitelynx.co.nz *(VM101)* → backend https://supadupabase.whitelynx.co.nz *(VM106)*

## Status

**Save point `v0.3.2-development`** (2026-07-01) — **`main` at `b5168b9` on GitHub.** Production still on `v0.3.1-production` (`app.js?v=28`) until home deploy.

| Done (on GitHub `main`) | Follow-up |
|---------------------------|-----------|
| PWA + tunnel, invite-only auth | **Deploy to VM101** (hook works; PWA still v28) |
| **Remote deploy hook on VM101** ✅ | Fix VM106 hook (502) |
| **Save only when day row is dirty** | Data API date-range filters |
| Delete button removed | Integration tests, license |

Details: [SAVEPOINT.md](./SAVEPOINT.md) · Handoff: [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) · **Deploy at home:** [HOME_PC_SETUP.md](https://github.com/johngoodspeed77/supadupabase/blob/main/infra/HOME_PC_SETUP.md#quick-checklist--run-when-you-get-home)

**Cache (this release):** `app.js?v=29` · `hours.js?v=28` · `styles.css?v=14` · SW `timesheet-app-v30`

## Quick start (local)

### 1. Start SupaDupaBase

```bash
cd ../supadupabase
npm install && npm run build
cp .env.example .env
docker compose -f infra/docker-compose.dev.yml up -d
npm run migrate
npm run dev
```

### 2. Start Timesheet App

```bash
cd ../timesheet-app
npm install
npm run dev            # http://localhost:5180
```

### Tests

```bash
npm test
```

## Deploy

See [infra/DEPLOY_VM101.md](./infra/DEPLOY_VM101.md) and [HOME_PC_SETUP.md](https://github.com/johngoodspeed77/supadupabase/blob/main/infra/HOME_PC_SETUP.md).

```bash
cd /opt/timesheet-app && git pull && chmod +x infra/deploy-quick.sh
DOCKER_BUILDKIT=0 docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build timesheet-app
```

## What it does

| Feature | Description |
|---------|-------------|
| Auth | Invite-only email/password via SupaDupaBase |
| Daily entry | **Work**, **Day off**, or **Leave** per row; **Save** appears only after you change that day |
| Defaults | Mon–Fri Work (8:00–16:30); Sat–Sun Day off |
| Overtime | >8 h/day; Sat 1.5×, Sun 2× |
| Submit | Fuzed Group HTML email to boss; locks week |
| Mobile | Responsive layout; ↻ Refresh on sign-in |

## Backend dependency

SupaDupaBase with migrations through `009_leave_entries.sql`, mail-service SMTP, `INVITE_ONLY=1`.

## Troubleshooting

- **Save not visible:** Edit the row first — Save only shows when there are unsaved changes.
- **Stale UI after deploy:** Hard refresh (Ctrl+Shift+R) or ↻ Refresh on sign-in.
- **Sign-in issues:** Production is invite-only; use ↻ Refresh if cache is stale.

## License

TBD
