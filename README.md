# Timesheet App

Weekly timesheet PWA — log start/finish times Mon–Sun, track overtime and leave, and email your boss at week end. Built on [SupaDupaBase](https://github.com/johngoodspeed77/supadupabase).

**Repository:** https://github.com/johngoodspeed77/timesheet-app

**Production:** https://timesheet.whitelynx.co.nz *(VM101)* → backend https://supadupabase.whitelynx.co.nz *(VM106)*

## Status

**Save point `v0.4.0-production`** (2026-07-02) — **`main` at `369f891`**, deployed to VM101.

| Feature | Status |
|---------|--------|
| Dirty Save UI (no Delete) | ✅ Live |
| Quarter-hour time selects (iOS PWA) | ✅ Live |
| Work schedule settings (part-time) | ✅ Live |
| Remote deploy hook (VM101) | ✅ Live |

Details: [SAVEPOINT.md](./SAVEPOINT.md) · Handoff: [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) · Deploy: [HOME_PC_SETUP.md](https://github.com/johngoodspeed77/supadupabase/blob/main/infra/HOME_PC_SETUP.md)

**Cache:** `app.js?v=32` · `hours.js?v=31` · `styles.css?v=17` · SW `timesheet-app-v33`

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
bash infra/deploy-quick.sh
```

## What it does

| Feature | Description |
|---------|-------------|
| Auth | Invite-only email/password via SupaDupaBase |
| Daily entry | **Work**, **Day off**, or **Leave** per row; **Save** appears only after you change that day |
| Work schedule | Settings: work days, hours/day, start time (default Mon–Fri 40 h/week @ 08:00) |
| Time entry | Quarter-hour dropdowns (15 min steps) — works on iPhone Chrome PWA |
| Overtime | >8 h/day; Sat 1.5×, Sun 2× |
| Submit | Fuzed Group HTML email to boss; locks week |
| Mobile | Responsive layout; ↻ Refresh on sign-in |

## Backend dependency

SupaDupaBase with migrations through `010_work_schedule.sql`, mail-service SMTP, `INVITE_ONLY=1`.

## Troubleshooting

- **Save not visible:** Edit the row first — Save only shows when there are unsaved changes.
- **Stale UI after deploy:** Hard refresh (Ctrl+Shift+R) or ↻ Refresh on sign-in.
- **Sign-in issues:** Production is invite-only; use ↻ Refresh if cache is stale.
- **Part-time hours:** Settings → Work schedule — tick your days and save.

## License

TBD
