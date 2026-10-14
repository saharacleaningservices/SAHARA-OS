# Sahara OS — Canonical Master Task Register

Created 2026-10-14. One register; IDs are stable (`SOS-01 … SOS-15`) and follow the owner's "Final Master Prompt" list (Task 01–15). Later chats renumbered "Task 1" to mean Backup/DR — that is **SOS-03**. Statuses: VERIFIED COMPLETE / PARTIALLY COMPLETE / PENDING CLAUDE / PENDING OWNER / BLOCKED / NOT TESTED. "Source" says where the status comes from; anything marked *carried over* was reported earlier and has **not** been re-verified in this pass.

No secrets appear here (names/locations only). Production boundary: no push to `coolify-deploy`/`main`, DNS, firewall, billing or customer messaging without the owner's explicit approval; a tool-level block on production pushes was hit on 2026-10-14 (see SOS-03) and was not worked around.

## Summary

| ID | Task | Pri | Status |
|---|---|---|---|
| SOS-01 | CRM production recovery (stale tabs after deploy) | P0 | VERIFIED COMPLETE (deployed `110f31d`); staff-device confirmation outstanding |
| SOS-02 | Altaf direct inquiry + one-click follow-up | P0 | PARTIALLY COMPLETE (live `f81fbdb`); real-device acknowledgement pending |
| SOS-03 | Backup, disaster recovery, hosting security | P0 | PARTIALLY COMPLETE — backup + restore VERIFIED; alerts built locally, NOT deployed; encryption + 2nd copy pending owner |
| SOS-04 | GitHub, Coolify, production deployment | P1 | PARTIALLY COMPLETE; exposed ports risk open |
| SOS-05 | WhatsApp Cloud API + customer messages | P1 | PARTIALLY COMPLETE (TEST MODE); campaign launch gated |
| SOS-06 | Cognito forms → CRM → WhatsApp | P1 | BLOCKED/PENDING OWNER — bridge script not installed; recent enquiries not in CRM |
| SOS-07 | Google Ads — Brand Make unlink + support | P1 | PENDING OWNER DECISION — manager still linked; Sahara admin access verified |
| SOS-08 | Meta Business assets + ads ownership | P1 | PARTIALLY COMPLETE (account audited 2026-10-14; billing owner-only) |
| SOS-09 | Staff operations + mobile QA | P1 | NOT TESTED on real devices |
| SOS-10 | Google Workspace email migration | P1 | PENDING (no verified work in this context) |
| SOS-11 | Google Business Profile + marketing assets | P2 | PARTIALLY COMPLETE (audit done; corrections need owner login) |
| SOS-12 | Website migration to Sahara VPS | P1 | PENDING (www still on cPanel) |
| SOS-13 | Website redesign + landing pages | P1 | PARTIALLY COMPLETE (landing pages exist; redesign pending) |
| SOS-14 | Google Ads + Meta Ads launch | P1 | BLOCKED by SOS-05/07/08 and owner budget approval |
| SOS-15 | Final documentation + handover | P1 | PARTIALLY COMPLETE (this register, runbook, Drive Technical Master + updates) |

## Detail

### SOS-01 — CRM production recovery · P0
- **Outcome:** CRM usable after deployments. **Root cause:** open browser tabs kept calling stale Server Action ids.
- **Evidence:** fix `110f31d` (build-id check via `/api/notifications/feed` + reload banner) is on production `coolify-deploy`; verified locally (banner appears) and in production (feed returns build id). *Source: earlier session + git history.*
- **Remaining:** confirm on Shoyab's/Francis's real devices after the next deployment. **Risk:** low. **Owner:** none.
- **Acceptance:** after a deploy, open tabs show the reload banner and actions keep working.

### SOS-02 — Direct inquiry intake + one-click follow-up · P0
- **Outcome:** Altaf adds a number in seconds; Shoyab/Francis get an alert and record outcomes in one click; owner tracker. **Live** in `f81fbdb`; 15 TypeScript tests (`npm run test:inquiry`) pass.
- **Remaining:** Shoyab/Francis device acknowledgement of the live test inquiry (LD-2026-0181) — pending real-device action. Do not create fake leads.
- **Acceptance:** alert seen on both devices, outcome recorded, tracker shows who/when.

### SOS-03 — Backup, disaster recovery, hosting security · P0
- **VERIFIED (2026-10-14):** nightly workflow green (run #86 manual, many scheduled runs); Drive file `sahara-os-20261014-174048.tar.gz` 5,301,551 B; isolated restore RESTORABLE, `integrity_check` ok before/after migration, 15 users / 4,231 customers / 227 leads / 247 jobs / 224 payments / 47 quotations / 23 invoices / 9 upload files; CRM pages (Leads, Jobs, Payments, Quotations, Invoices, Customers) load on the restored scratch copy; Leads 221 vs 204 explained (17 soft-deleted). Evidence: `docs/BACKUP_ALERTS_ROLLOUT_PLAN.md` §5, `docs/DISASTER_RECOVERY_RUNBOOK.md`.
- **Done locally, NOT deployed:** backup-failure GitHub Issue alert + size-verified Drive upload (`feat/backup-alerts-workflow` `957e7f1`, based on `main`); CRM 26-hour stale-backup alert + `/api/backup/confirm` (`feat/backup-alerts` `dfa1073`, `a5531ab`, `567f29d`, `32e0904` badge fix). Tests: `test:backup` 10/10, Python 16/16, `tsc` clean, `npm run build` ok. Read-only pre-deployment review: fast-forward safe from `f81fbdb`, no schema change.
- **BLOCKED:** pushing to `coolify-deploy` / the workflow branch was denied by the tool's production-deploy rule. Needs the owner to allow it (explicit instruction or Bash permission rule) — one decision.
- **Encryption assessment (2026-10-14, throwaway key, synthetic archive, temp files deleted):** the exact `openssl enc -aes-256-cbc -pbkdf2 -salt` commands planned for the workflow encrypt and decrypt back to a byte-identical archive; a wrong key fails (`bad decrypt`, exit 1); ciphertext is salted (`Salted__`). So the mechanism works; only the owner-held key is missing.
- **PENDING OWNER (security decisions):** (a) backup encryption key (`BACKUP_ENCRYPTION_KEY` was never created; all Drive backups are plaintext) — plan in runbook §9a; (b) second independent off-site copy — options in §9b (nothing purchased).
- **Retention verified (2026-10-14):** Drive holds 32 backups (30 daily + 2 monthly keepers), oldest 2026-09-30; daily tier is count-based so many manual runs shorten real history (8 Oct had ~17) — see runbook §2.
- **Not verified:** real GitHub Actions run of the new workflow, live alert e-mail, new-VPS rebuild time (RTO is an estimate), Coolify-config backup.
- **Rollback:** CRM — redeploy `f81fbdb`; workflow — revert on `main`; no schema change.
- **Acceptance:** deployed + a green run that writes a `DELIVERED` row + a real failure alert received + encrypted copy restore-tested + second copy restore-tested.

### SOS-04 — GitHub, Coolify, production deployment · P1
- **Verified/carried over:** Coolify 4.4.6 on Hostinger VPS (weekly Hostinger backups, 2 snapshots); auto-deploy from `coolify-deploy` via GitHub App; production = `f81fbdb`; `main` = `595d9b3` (holds the backup workflows); Coolify root access recovered with the official reset commands.
- **Open risk (P0 security):** ports 8000/6001/6002 reachable from the internet, Hostinger firewall has 0 rules. Changing a firewall needs owner approval + a rollback plan (not done).
- **Remaining:** firewall decision; consider SSH key-only + Coolify admin behind restricted IPs. **Owner approval required.**

### SOS-05 — WhatsApp Cloud API + customer messages · P1
Report separately (per directive):
- **API readiness — VERIFIED (carried over + webhook probes):** WABA connected, number quality High, outbound in TEST MODE, webhook rejects bad token (403) and unsigned/bad-signature posts (401); delivered/read ticks visible in the Inbox.
- **Template approval — carried over:** booking/review/reactivation/Diwali templates Active in Meta.
- **Consent readiness — NOT READY:** 1 opted-in of 4,312 contacts. Promotions are allowed only to recorded opt-ins.
- **Opt-out / duplicate prevention — VERIFIED locally (code audit + tests, 2026-10-14):** webhook STOP/UNSUBSCRIBE (whole-message match; CANCEL is never an opt-out) sets `WhatsAppConsent.optedOut` and the lead's `marketingConsent`; broadcast is Admin-only, needs Cloud API ready, LIVE needs `WHATSAPP_CAMPAIGNS=on`, uploads never grant consent (only recorded opt-in and no STOP), contacts are de-duplicated, each send re-checks STOP (fail-closed), a campaign never re-sends to a number already SENT/QUEUED, one broadcast at a time. Tests: branch `feat/whatsapp-optout-tests` `9cd004f` (`npm run test:whatsapp`, 4/4; no production code changed; not pushed).
- **Delivery reporting — done locally, not deployed:** Message Log now shows DELIVERED/READ from the existing `deliveredAt`/`readAt` webhook data (branch `feat/message-log-delivery` `9728d7f`, based on production `f81fbdb`; `tsc` clean; no schema change; not pushed). **Verified 2026-10-14** on a scratch DB (4 seeded messages: SENT / DELIVERED / READ / FAILED; admin login 200, page 200, each status rendered once per layout; scratch server and data deleted).
- **Campaign launch — NOT AUTHORISED:** live sends stay OFF until the owner approves; a small test audience (approved test number 9921215250) first. Guardrails: never touch the old WABA; AI/auto-replies OFF.

### SOS-06 — Cognito forms → CRM → WhatsApp · P1
- **Status: BLOCKED / PENDING OWNER (found 2026-10-14, read-only).** CRM intake `/api/webhook/email-lead` exists, fails closed (production returns 401 without the bearer token). But the **sender is missing**: the contact@ account has **no Apps Script projects**, so Cognito enquiries reach Gmail only. Gmail shows 201 Cognito threads, latest 13 Oct 2026; five consecutive enquiries from 7–13 Oct were searched in the live CRM leads list (210 leads) by name and number and **none were found** — enquiries are probably being handled outside the CRM or missed.
- **Done (local):** ready-to-install bridge `docs/cognito-email-lead.gs` (reads only Cognito notification mails, labels processed threads `CRM-synced`, token from Script Properties; parser checked on made-up samples; no customer data in the repo).
- **Owner steps (one at a time):** (1) in Coolify confirm/set `EMAIL_LEAD_TOKEN` (secret — owner only); (2) install the script per its header (Google asks the owner to authorise Gmail access); (3) tell Claude, who then verifies with the next real enquiry (no fake leads).
- **Acceptance:** a new Cognito enquiry appears in CRM Leads within ~5 min, de-duplicated, with Admin/Accounts/Operations alerts.

### SOS-07 — Google Ads: Brand Make unlink + support · P1
- **Verified 2026-10-14 (read-only in the owner's signed-in Google Ads, customer account "Sahara Cleaning"):** manager **Brand Make Digital Marketing Solution** is still linked (since 30 Jan 2026, type Google Ads, **Owner: No**). The account has **1 user, 1 admin (Sahara's own)**, 0 passkey-disabled users, so Sahara's access is intact. Balance is exhausted (account not spending). Gmail holds only the link confirmation (30 Jan 2026) and Brand Make invoices (to Jul 2026); **no Google Ads support case exists** and none was opened by Claude.
- **Official route:** an account admin can remove a manager himself: Admin → Access and security → Managers → "Remove access" (Google's documented self-service flow; a support case is only needed if the admin cannot do it). That click removes a third party's access — **explicit owner decision**, and the tool layer previously denied it. Claude did not click it.
- **Owner step (one):** decide "remove Brand Make now" — then either click **Remove access** on the Managers tab and confirm with your passkey, or tell Claude to do the click (the passkey prompt, if shown, is yours). Before removal: ask Brand Make (accounts@brandmake.in) for any assets they hold (conversion tracking, reports, billing) — nothing in Gmail shows they own any.
- **Not done / not claimed:** unlink not completed; no support case reference. Do not add funds or change billing.

### SOS-08 — Meta Business assets + ads ownership · P1
- **Verified 2026-10-14 (read-only, owner's signed-in Meta):** Sahara-owned ad account `343079872519451`; business name Sahara Cleaning Services, INR, GST verified. **Funds ₹0.00, no payment method, no recent spend.** Campaigns (last 30 days): 3 — "Post: Keep your glass maintain and clean…", "INDEPENDENCE DAY SALE", "Post: Sahara Cleaning Services was live." — all switched **On** but delivery = **Payment error**, no results/spend.
- **Risk:** as soon as a payment method/funds are added these three On campaigns could start spending. Review and switch off/replace before adding billing (not changed by Claude — no publish/activate/schedule/spend).
- **Legitimate reuse:** the three are old boosted posts/sale creative — reuse creative as inspiration only; new campaigns should be built fresh from the approved landing pages with Pixel/CAPI checks. Not started.
- **Owner steps (later, one at a time):** add a payment method (owner only), then approve a budget; until then SOS-14 stays blocked. Note the ad account business address shows Magarpatta — an ad-account setting, left unchanged.

### SOS-09 — Staff operations + mobile QA · P1
- `STAFF_APP_DEVICE_QA.md` exists. **NOT TESTED** on real staff devices in this pass. Next: QA checklist on actual phones (attendance, job card, consent tap, sound/alerts).

### SOS-10 — Google Workspace email migration · P1
- MX → Google Workspace (verified by DNS lookup 2026-10-14). No migration work verified here. **Dependencies:** SOS-12 (website hosting/cPanel mail). Security review of SPF/DKIM/DMARC not yet done.

### SOS-11 — Google Business Profile · P2
- Both listings audited (Report 3, Drive). Facts to keep: PIN 411060, phone 8956567130, established 2012; Mohammad Wadi Road is an operational office, never advertised as a customer visit location; never touch the Magarpatta profile. Corrections need the owner's Google login — **PENDING OWNER**.

### SOS-12 — Website migration to Sahara VPS · P1
- DNS 2026-10-14: `www` → 192.185.129.241 (cPanel host), `crm`/`booking`/`app` → 187.53.134.175 (VPS). Migration = DNS change → **owner approval + rollback plan required**. Not started.

### SOS-13 — Website redesign + landing pages · P1
- Landing pages exist in the CRM repo (`/landing/*`, `/offers`, category pages; commits `a24a7b7`, `461665e`…). Corporate redesign and SEO plan (Report 3) pending; homepage title issue noted (long Kharadi-only title). Depends on SOS-12 for the main site.

### SOS-14 — Google Ads + Meta Ads launch · P1
- **BLOCKED:** depends on SOS-05 (consent/tracking), SOS-07, SOS-08 and an owner-approved budget. No spend, no campaign activation without explicit approval.

### SOS-15 — Final documentation + handover · P1
- Exists: Drive Technical Master + UPDATE 1/2 + Report 3; repo `docs/DISASTER_RECOVERY_RUNBOOK.md`, `docs/BACKUP_ALERTS_ROLLOUT_PLAN.md`, this register. Remaining: merge facts into one Technical Master at the end, final consolidated report.

## Current git state (2026-10-14)
- Production `coolify-deploy` = `f81fbdb` (unchanged). `main` = `595d9b3` (unchanged). `coolify-deploy-current` = `aeab587` (untouched).
- Local, unpushed: `feat/backup-alerts` = `754deaf`, `dfa1073`, `a5531ab`, `567f29d`, `32e0904`; `feat/backup-alerts-workflow` = `957e7f1` (own worktree `../sahara-os-wf-main`).
- Never committed: `dev.db`, `.claude/launch.json`, marketing images, `CLAUDE.md`, `SAHARA_OS_MASTER_CONTEXT.docx`, `WHATSAPP_CAMPAIGN_REVIEW.md`, `audits/`.

## Next ready work (no owner needed)
1. SOS-05: recording more marketing opt-ins needs real customer consent (owner/staff).
2. SOS-09: QA checklist for staff devices (prepare; real-device run needs people).
3. SOS-06: read-only check of the Cognito → CRM path.
4. Keep SOS-03 push blocked item visible; resume the moment the owner permits.
