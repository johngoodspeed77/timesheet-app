# Save point — v0.3.1-production

**Date:** 2026-06-30  
**Git tag:** `v0.3.1-production` (docs; app code unchanged since `v0.3.0-production` / `fcae809`)  
**Repository:** https://github.com/johngoodspeed77/timesheet-app  
**Branch:** `main`

## Milestone summary

**Production PWA live** on VM101 at https://timesheet.whitelynx.co.nz, backed by SupaDupaBase on VM106 (Option B). Work/day-off/leave rows, mobile layout, sign-in reliability fixes, invite-only auth, week submit. **Boss email** now shows the employee as sender and uses **Fuzed Group** branding (SupaDupaBase mail-service `92c1e2b`, `fe60026`). Service worker **v29**.

## Production (live)

| Item | Value |
|------|--------|
| Public URL | https://timesheet.whitelynx.co.nz |
| VM | `johngoodspeed@192.168.1.19` (VM101) |
| Deploy path | `/opt/timesheet-app` |
| Backend | https://supadupabase.whitelynx.co.nz (VM106) |
| Auth mode | **Invite-only** — admin invites via SupaDupaBase |
| Timesheet tag | `v0.3.0-production` (`fcae809`) — PWA assets below |
| Backend tag | SupaDupaBase `v0.2.2-production` — mail + migration 009 |

**Redeploy after code changes on VM101:**

```bash
cd /opt/timesheet-app
git pull
DOCKER_BUILDKIT=0 docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

**Redeploy mail after backend changes on VM106:**

```bash
cd ~/supadupabase
git pull
docker compose -f infra/docker-compose.yml --env-file .env up -d --build mail-service
```

## What works

- Invite-only sign-in + persistent session (`lib/session.js`)
- **Work / Day off / Leave** per day; leave types (paid + non-paid)
- Mon–Fri auto-fill; Sat–Sun default Day off; weekend times blank until entered
- OT shown as `8.00h + X.XXh OT`; lunch breakdown subtext
- Mobile layout (Send button, day rows, settings) at 375px / 320px
- Submit week → email + lock; unlock available
- **Boss email** — `From: "Employee Name" <user@email>`, `Reply-To: user@email`; title **Fuzed Group- Employee Weekly Timesheet** (SMTP envelope still `SMTP_FROM` on VM106)
- **↻ Refresh** on sign-in; `hours.js` cache-busted with `app.js`
- Hours regression tests (`npm test`)

## Cache versions (PWA — unchanged since v0.3.0)

| Asset | Version |
|-------|---------|
| `app.js` | `?v=28` |
| `hours.js` | `?v=28` |
| `sw.js` | `?v=29` (`timesheet-app-v29`) |
| `styles.css` | `?v=13` |

## Key changes (v0.3.0 → v0.3.1)

| Area | Summary |
|------|---------|
| Boss email From | Employee display name + login email (`mail-service` `submit.ts`) |
| Boss email branding | Fuzed Group title in HTML + plain text (`TIMESHEET_EMAIL_TITLE`) |
| Email subject | **Week ending** + Sunday date (Mon–Sun week) |
| Backend | Migration `009_leave_entries.sql` on VM106; leave rows in email template |

## Key changes (v0.2.0 → v0.3.0)

| Area | Summary |
|------|---------|
| Leave | Migration 009; leave UI; day off as row mode |
| Sign-in | Race fix, token snapshot, module cache bust |
| UI | Hide time picker icon; OT display; mobile CSS pass |
| Totals | Removed paid equivalent |

## Troubleshooting

- **Sign-in greyed out:** ↻ Refresh — stale SW `hours.js` vs `app.js`.
- **Stale UI after deploy:** Hard refresh; SW network-first for HTML/JS.
- **Submit fails:** Boss email in Settings + SMTP on VM106.
- **Boss sees "via gmail.com":** Gmail may show relay hint when `From` domain is not a verified "Send mail as" alias; **Reply-To** still routes to the employee.

## Not done / follow-up

- Data API date-range filters
- Integration tests
- License

## Last updated

2026-06-30
