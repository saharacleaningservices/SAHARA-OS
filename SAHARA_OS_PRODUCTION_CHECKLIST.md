# Sahara OS — Final Production Checklist

_Compiled 2026-09-21 as Phase 10 of the "Phase 1-10 production polish" prompt, synthesizing this session's work plus everything already recorded in `SAHARA_OS_STATUS.md`. Every claim below traces to a specific commit, a specific document, or is explicitly marked as needing the owner's own action (real credentials, a live login, or Meta/Google account access this session cannot and should not have)._

## Completed items

| Area | Status | Evidence |
|---|---|---|
| Role permissions (Altaf/Shoyab/Francis) | CODE COMPLETE | `SAHARA_OS_MASTER_REQUIREMENTS.md` #1/#2, `SAHARA_OS_STATUS.md` §3.12/§3.14 |
| Customized Service pricing (editable Unit Price) | CODE COMPLETE | `SAHARA_OS_STATUS.md` §3.13, commit `313ec05` |
| Customers module (search/call/WhatsApp/edit/offer/import-export/restore) | CODE COMPLETE | §3.14 |
| Table density + synced scrollbar + mobile card layout (Jobs/Leads) | CODE COMPLETE | §3.14, §3.16, commits `ffee68c`/`d9912ff` |
| Customer Actions top bar (replaces floating button) | CODE COMPLETE | §3.14, commit `47284ed` |
| Calendar widget for all roles, RBAC-scoped detail | CODE COMPLETE | §3.16, commit `dfcd182` |
| Security audit + 4 real fixes (fail-open webhook, Meta signature, login history, unauthenticated Server Action) | CODE COMPLETE | `SAHARA_OS_SECURITY_AUDIT.md`, commit `09fa3e1` |
| Backup: S3-compatible primary + weekly encrypted + Google Drive demoted | CODE COMPLETE, **owner action needed to activate** | §3.16, commit `09fa3e1` — needs `S3_BUCKET` etc. as GitHub secrets |
| WhatsApp Cloud API readiness (3-button flow, no visible phone number, interactive list) | CODE COMPLETE, not connected | §3.16, commit `3a03b01` |
| Meta Business readiness (OG tags, domain verification, Pixel) | CODE COMPLETE, not connected | `SAHARA_OS_META_READINESS.md`, commit `6811cca` |
| CRM automation — WhatsApp inquiry auto-lead | CODE COMPLETE | §3.16, commit `7e922e4` |
| Owner Intelligence — Cancelled/Postponed Jobs alerts | CODE COMPLETE | §3.16, commit `2685a4c` |
| Performance — DB indexes + search debounce | CODE COMPLETE | §3.16, commit `aafe24e` |

**Every item above**: `tsc --noEmit` and `npm run build` clean at the time of its commit; pushed to `coolify-deploy`, which Coolify auto-deploys on every push.

## Remaining blockers

1. **Nothing in this whole batch is LIVE VERIFIED.** This session's browser had no active authenticated login at any point, and re-authenticating by entering the owner's or any real user's password is categorically off-limits regardless of framing — the same rule this project has followed since `SAHARA_OS_STATUS.md` §3.9. The single highest-priority next step is: someone actually logs in as Altaf, Shoyab, and Francis and clicks through the checklist each STATUS.md section already lists (Calendar's three detail levels are the most important one — verify Francis genuinely can't see a phone number, and Shoyab genuinely only sees counts).
2. **Backup S3 destination is code-ready but inert** until `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (and optionally `S3_ENDPOINT_URL`, `S3_REGION`, `BACKUP_ENCRYPTION_KEY` for the weekly encrypted tier) are added as GitHub Actions repository secrets.
3. **WhatsApp Cloud API is still not connected** — needs a Meta WhatsApp Business Account, the `booking_confirmation_v2` template submitted and approved, and `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_APP_SECRET`/`WHATSAPP_WEBHOOK_VERIFY_TOKEN` configured. See `SAHARA_OS_META_READINESS.md` step 8.
4. **Meta Business Portfolio / Ad Account / Pixel / Conversion API are all account-side steps** only the owner (or whoever holds Meta Business Manager access) can do — see `SAHARA_OS_META_READINESS.md`'s full checklist.
5. **Two security items deliberately deferred, not forgotten**: no server-side session revocation (a stateless JWT can't be force-expired before its 12-hour TTL), and no Content-Security-Policy header (needs careful, separately-tested construction to avoid a functional regression). See `SAHARA_OS_SECURITY_AUDIT.md` §4.
6. **`getCustomersList()`'s full-table-fetch pattern** (4000+ customers, unpaginated, aggregated in application code) is a real performance cost that wasn't rewritten this pass — too risky to change blind without a live session to verify against. See §3.16's Phase 9 note.
7. **GMB inquiry auto-ingestion** isn't built — needs Google Business Profile API credentials this environment doesn't have.

## Security score

**8.5 / 10** — see `SAHARA_OS_SECURITY_AUDIT.md` for the full breakdown. Four real defects found and fixed in the same pass; five items disclosed and deliberately deferred; everything else (RBAC, JWT/session, password hashing, rate limiting, CSRF, XSS, SQL injection, file upload security, audit logs, device approval) reviewed and found solid.

## Backup status

**Architecture: ready. Activation: pending owner action.** Daily VACUUM-INTO snapshot with an integrity check, uploaded to an S3-compatible bucket (primary) and optionally Google Drive (secondary/legacy) — but neither destination's credentials are configured in GitHub Actions yet, so the daily workflow currently has nowhere to actually deliver a backup to until at least one is set. One-click restore (with a pre-restore safety copy of the live database, archive validation, and full audit logging on every path) was already built before this pass and re-verified working. Weekly full AES-256-encrypted backup is new and also pending the same S3 secrets plus `BACKUP_ENCRYPTION_KEY`.

## Meta readiness

**Code: ready. Account: not started (not visible from this codebase).** Domain verification tag, Open Graph/Twitter Card metadata, and an inert Meta Pixel + Lead event are all built and waiting on env vars. Facebook Page ownership, Business Portfolio, Instagram connection, Ad Account, and Conversion API all require the owner's own Meta Business Manager access — see `SAHARA_OS_META_READINESS.md` for the exact step-by-step order.

## WhatsApp readiness

**Code: ready. Connection: not started.** The redesigned 3-button booking-confirmation template (`booking_confirmation_v2`), the interactive "More Options" list (7 rows, no phone number in the initial message), the webhook signature verification, and the WhatsApp-inquiry auto-lead trigger are all built and tested by `tsc`/build, but WhatsApp Cloud API credentials remain unconfigured everywhere in this environment — by explicit instruction ("do not integrate yet").

## Production readiness percentage

**~78%.**

This is a judgment call, not a formula, so here's the reasoning: the core CRM/ERP (Leads, Jobs, Staff, Attendance, Payments, Expenses, Customers, Reports, RBAC, dashboards) is real, live, in daily use, and has been through many rounds of live-verified fixes across this whole session's history — call that the solid ~60-65% floor. This batch's code-complete-but-not-live-verified work (Calendar RBAC, table UX, security fixes, backup architecture) adds real, working value but can't be counted at full weight until someone actually clicks through it as Altaf/Shoyab/Francis — call that another ~10-13%. The remaining ~22-25% is genuinely not done and correctly not claimed as done: WhatsApp Cloud API isn't connected, Meta Business migration hasn't started, backup's S3 destination has no credentials yet, and two disclosed security hardening items (CSP, session revocation) are still open. None of those gaps block the business from operating today — they're the difference between "a working, secure, actively-used system" (true now) and "the fully wired, ads-ready, disaster-recovery-tested version of the same system" (not yet true).
