# Environment Variables

Variable **names and purpose only** — no real values, as none of these
should ever be committed to the repository. Set these in Coolify's
Environment Variables tab for the app (or `.env` locally, copied from
`.env.example`).

## Required

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite connection string, e.g. `file:./dev.db`. On production, this should point at a path on a persistent volume — see `DEPLOYMENT_GUIDE.md`. |
| `AUTH_SECRET` | Signing secret for session JWTs. Must be long and random; changing it logs out every session. |

## Domain / URL split (added 2026-09-22)

| Variable | Purpose |
|---|---|
| `BOOKING_URL` | Public customer-facing booking domain, e.g. `https://booking.saharacleaningservices.com`. Unset = falls back to the legacy single-domain URL, and every domain-split behavior stays fully inactive. |
| `CRM_URL` | Internal CRM domain, e.g. `https://crm.saharacleaningservices.com`. Same fallback behavior as above. |
| `LEGACY_APP_REDIRECT_ENABLED` | Set to `"true"` only after both domains above are confirmed working in production — turns on the old-domain → CRM redirect for non-booking paths. |

## Optional integrations (all follow "queue always, deliver only if configured" — nothing breaks if these are unset)

| Variable | Purpose |
|---|---|
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_API_VERSION` | Meta WhatsApp Cloud API. Can also be set from Settings → Integrations instead (DB takes precedence). |
| `WHATSAPP_APP_SECRET` | Verifies Meta's webhook signature (`X-Hub-Signature-256`). Without it, webhook signature verification is skipped (not rejected) — set this once Cloud API is connected. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | The token you paste into Meta's webhook setup dashboard. |
| `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Powers "Use Current Location"/"Pin on Map." Without it, "Paste Maps Link" still works. |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_ENDPOINT`, `SMS_SENDER_ID` | Fallback SMS channel for staff notifications/review requests. |
| `EMAIL_API_KEY`, `EMAIL_ENDPOINT`, `EMAIL_FROM` | Transactional email (password reset, login ID recovery). |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push notifications. Generated automatically from Settings if not provided. |
| `ADMIN_WHATSAPP_NUMBERS` | Comma-separated numbers that receive owner-facing WhatsApp alerts (new bookings, etc.). |
| `NEXT_PUBLIC_META_PIXEL_ID`, `META_DOMAIN_VERIFICATION` | Meta Ads readiness (Pixel + domain verification) — not required for anything else to work. |

## Backup / export

| Variable | Purpose |
|---|---|
| `BACKUP_TOKEN` | Bearer token that authorizes `GET /api/backup` for the GitHub Actions workflow. Can also be generated/rotated from Settings → Integrations → Backup. |
| `CRON_TOKEN` | Authorizes the internal reminders cron route (`/api/cron/reminders`). |
| `MISSED_CALL_TOKEN` | Authorizes the missed-call webhook route. |
| `GDRIVE_FOLDER_ID` | Only relevant to the GitHub Actions backup workflow (not read by the app directly except to display it) — see `BACKUP.md`. |

## Platform-provided (don't set manually)

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Set by the build/runtime (`production` in the Docker image). |
| `PORT` | Set by Coolify/Docker; the app listens on this. |

## Removed (2026-09-22)

`MYBILLBOOK_API_KEY` and `MYBILLBOOK_API_BASE_URL` were removed along with
the entire MyBillBook integration (it was never configured in production —
see `SAHARA_OS_STATUS.md` for details). If you find these still set in
Coolify, they're now unused and can be deleted.
