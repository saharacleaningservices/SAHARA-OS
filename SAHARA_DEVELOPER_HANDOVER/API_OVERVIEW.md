# API Overview

Most of the app never needs a "real" HTTP API — pages call Server Actions
directly. These `src/app/api/**` routes exist only where an actual HTTP
response is required: file downloads, webhooks, and cross-origin/
token-authenticated calls. **Do not add a new API route for something a
Server Action could do** — that's the pattern to follow for anything else.

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/login` | POST | none (it IS the login) | Mobile/email + password login, rate-limited, device-gated for some roles. |
| `/api/auth/logout` | POST | session cookie | Clears the session. |
| `/api/auth/device-status` | GET | none | Polled by the login page while a new-device WhatsApp OTP/approval is pending. |
| `/api/backup` | GET | Bearer `BACKUP_TOKEN` OR Admin session | Streams a `.tar.gz` snapshot of the database + uploads. Used by the GitHub Actions backup workflow and the in-app "Download Backup Now" button. |
| `/api/backup/restore` | POST | Admin session + CSRF check + typed `RESTORE` confirmation | Restores the database from an uploaded backup archive. See `BACKUP_RESTORE_GUIDE.md`. |
| `/api/export/business-data` | GET | Admin session only | Streams `SAHARA_DATA_YYYY-MM.zip` — the portable business data export. Added 2026-09-22. |
| `/api/quotations/[id]/pdf` | GET | Any signed-in ADMIN/ACCOUNTS/OPERATIONS session, or SUPERVISOR if the quotation's Lead is in their today/tomorrow scope | Renders a Quotation as a PDF. **Fixed 2026-09-22** — previously had no auth check at all. |
| `/api/invoices/[id]/pdf` | GET | ADMIN/ACCOUNTS/OPERATIONS only | Renders an Invoice as a PDF. **Fixed 2026-09-22** — previously had no auth check at all. |
| `/api/certificates/[id]/pdf` | GET | any signed-in session | Job completion certificate PDF. **Fixed 2026-09-22** — previously had no auth check at all. |
| `/api/jobs/[id]/card/pdf` | GET | session + `canAccessJob`, plus a same-day-only check for SUPERVISOR | Printable job card. |
| `/api/staff/performance/excel`, `/api/staff/performance/pdf` | GET | session + `canViewSalary` | Staff performance reports. |
| `/api/staff/[id]/payslip/pdf` | GET | session + `canViewSalary` | Individual payslip PDF. |
| `/api/upload` | POST | session (check the route for exact role scoping per folder) | File uploads — routes into image/audio/video/document folders by an allow-list. |
| `/api/booking-link/[token]/open` | GET | none (public) | Tracks a shared personalized booking link being opened (funnel: sent → opened → submitted). |
| `/api/notifications/feed` | GET | session | Polled by the in-app notification bell. |
| `/api/cron/reminders` | GET/POST | Bearer `CRON_TOKEN` | Scheduled follow-up/payment reminder processing — triggered externally (there is no in-app scheduler; see `DEPLOYMENT_GUIDE.md`/`BACKUP.md` for how the equivalent backup cron is wired via GitHub Actions — this route would need the same kind of external trigger). |
| `/api/webhook/missed-call` | POST | Bearer `MISSED_CALL_TOKEN` | Third-party missed-call service webhook → auto-creates a Lead. |
| `/api/webhooks/whatsapp` | GET (verify)/POST (events) | Meta signature verification (`WHATSAPP_APP_SECRET`) when configured | Inbound WhatsApp messages, delivery status, opt-out (STOP/START) handling. |

## A general lesson worth repeating

Three of the PDF routes above (`quotations/[id]/pdf`, `invoices/[id]/pdf`,
`certificates/[id]/pdf`) had **zero authentication** until 2026-09-22 —
anyone with the URL (a cuid, hard to guess but not secret) could view a
customer's name, mobile, address and quoted/invoiced amount, or a
completion certificate. This was found by re-reading the actual route
code while building the Quotations/Invoices feature, not by any automated
check. **When adding or touching an API route, always check it has an
explicit `getSession()` + role check — never assume one exists because the
route "feels" like it should.** The same pattern of missing checks was found
repeatedly across page-level code earlier in this project's history (see
`SAHARA_OS_STATUS.md`'s Francis-policy audit sections) — it is the most
common real bug class in this codebase.
