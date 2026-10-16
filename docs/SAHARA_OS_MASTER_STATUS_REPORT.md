# Sahara OS — Master Status Report
**As of 16 Oct 2026 (late night).** Canonical detail: `docs/MASTER_TASK_REGISTER.md`. One-click view: `SAHARA_OS_MASTER_STATUS_REPORT.html` (repository root; open in a browser, Ctrl+P → Save as PDF).

"Live" = running on the production website. "Ready" = built and tested, waiting for the owner's merge. Local tests are not proof of production.

## 1. Completed and verified
| Item | State | Evidence |
|---|---|---|
| Tabbed role-based dashboard (Admin / Accounts / Operations), status pills, Staff App alignment | **Live** (PR #3 merged 15 Oct, production `ccdd93d`) | Browser-tested 360/430/1280 px; Francis's page carries no money data |
| Google Ads — Brand Make manager access removed | **Verified** (15 Oct) | Managers list empty, 0 pending |
| Release PR #5 (`07424e0`, 58 commits): backup confirm + stale alert, Cognito HMAC + de-dup, festival date guard, logo/hero image weight cut, booking one-hop redirect + **true 404**, 56 px mobile header, role tests, **image caching**, **hidden-tab polling paused**, **Meta Pixel double-count fixed** | **Ready** — not merged | Production build exit 0; cognito 25, pricing 63, domains 4, roles 9, cache 3, polling 2, leadtrack 2, public 5, ops 7, inquiry 15, backup 10, eod 16, **seo 11** — all pass; tsc 0 |
| PR #4 (`04aec43`): backup workflow — verified Drive upload, failure alert, retention, AES-256 encrypted copy | **Ready** — needs secret | 22/22 workflow tests; encrypt→decrypt byte-identical; restore drill RESTORABLE |
| PR #6 (image cache) | Closed — included in PR #5 | — |
| WhatsApp consent system (`qa/whatsapp-launch-v2` `1db01a8`): consent guard, STOP / "Stop promotions", opt-in checkbox, delivery receipts | **Ready** — owner deploy decision | test:whatsapp 11/11 (incl. Meta signature check) |
| Nightly backups on `main` | **Live** | Scheduled runs succeed (run #88; GitHub starts them late, e.g. 04:38 instead of 02:00 IST) |
| Documentation | Done | Urgent actions, Workspace e-mail DNS runbook, ads audit (East Pune), Meta / green tick, website speed & SEO audit, task register |

## 1b. New today
| Area | Result |
|---|---|
| VPS capacity | KVM 2 (2 vCPU / 8 GB / 100 GB): RAM ~2.3 GB used, disk 6–11 GB normal; server response 0.24–0.42 s. A second (marketplace) site fits at launch scale with its own PostgreSQL and one-at-a-time builds — `docs/VPS_CAPACITY_AND_RESOURCE_AUDIT.md` |
| CRM light load | 3 background pollers now pause in hidden tabs; the urgent new-inquiry alert unchanged |
| Ads → CRM | Single validated entry point (landing forms → `publicBookLead`), tracking fields sanitised; Meta double count fixed — `docs/ADS_CRM_INTEGRATION_RUNBOOK.md` |
| WhatsApp templates (code) | Diwali promo: image header, name, **Book Festival Clean** (URL) + **Stop promotions**. Booking confirmation: **View Quotation**, **Pay Now / Later**, **Google Review**. test:whatsapp 11/11 |

## 2. Pending owner actions (priority order)
| # | Action | Deadline / why | Where |
|---|---|---|---|
| 1 | **Fix Google Workspace payment** | **2 Nov** — otherwise all e-mail stops | admin.google.com → Billing |
| 2 | **Renew website certificate** (AutoSSL for domain + www) | **1 Nov** — otherwise "Not secure" | cPanel → SSL/TLS Status |
| 3 | **Merge PR #5** (deploys the release; PR #6 is included) | Claude's merge blocked by the safety guard ("Production Deploy") | github.com/saharacleaningservices/SAHARA-OS/pull/5 |
| 4 | Change the WhatsApp test number to 9800817070 (2 lines; Claude blocked as "Real-World Transactions") | Before any test send | `src/lib/whatsapp.ts`, `src/server/whatsapp-audience.ts` |
| 5 | Add secret `BACKUP_ENCRYPTION_KEY`, keep a copy safely, then merge PR #4 | Encrypted off-site backups | GitHub → Settings → Secrets and variables → Actions |
| 6 | Approve the WhatsApp test-number change to **9800817070** (Claude's code change was blocked as "Real-World Transactions"; the code still uses protected 9921215250) and decide deployment of `qa/whatsapp-launch-v2` | Needed before any TEST send | Reply in chat |
| 7 | Cognito bridge: set `EMAIL_LEAD_TOKEN` (+ optional `EMAIL_LEAD_HMAC_SECRET`) in Coolify; install/trigger the Apps Script | Enquiries reach Gmail only today | `docs/COGNITO_CRM_SETUP_CHECKLIST.md` |
| 8 | E-mail authentication: SPF add Google, DKIM, DMARC | Spam risk; after #1 | `docs/WORKSPACE_EMAIL_DNS_RUNBOOK.md` (Namecheap) |
| 9 | Meta: switch old campaigns Off; check owner of ad account 343079872519451; Business Verification; then green tick | Before any ad spend | `docs/META_BUSINESS_GREEN_TICK_SETUP.md` |
| 10 | Retire Brand Make `promo.` page (after ads move to booking `/landing/*`) | Removes third-party tracking | `docs/WEBSITE_SPEED_AND_SEO_AUDIT.md` §4 |
| 11 | WordPress: cache plugin, H1, title/description, "Serving Pune Since 2012" instead of the counter | Speed 66 → 80+; SEO | `docs/WEBSITE_SPEED_AND_SEO_AUDIT.md` |
| 12 | Real-phone check with Shoyab, Francis and one field staff member | Last acceptance step | — |

## 3. Blocked for Claude (needs the owner)
- Production merges (PR #4, #5, #6) — blocked by the session safety guard; owner merges or explicitly changes the permission rule.
- Secrets (backup key, Cognito token), payments, OTP/passkey sign-ins, cPanel, Namecheap, WhatsApp Manager, Meta Business Suite.
- Live WhatsApp sends — no CRM login / API token for Claude; consent-first rules apply (≈2 opted-in contacts).

## 4. Known issues
- Flaky test: `tests/pricing.test.ts` "staff app (real DB)" failed 2 of ~12 runs (first run on a cold setup); not reproduced; noted in the register.
- 13 old ESLint warnings in untouched files (unused imports); no errors.
