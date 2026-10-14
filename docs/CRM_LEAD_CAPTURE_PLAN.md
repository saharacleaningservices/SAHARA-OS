# CRM as the primary lead system — status, tests and plan (2026-10-15)

Owner priority: **no additional expense.** Nothing below creates a paid subscription, connector, developer engagement, ad spend or campaign. Items that cost money are listed in §8 with the amount.

Evidence levels used throughout: **LOCAL** = tested on a developer machine with a scratch database; **STAGING** = tested on a separate deployed copy (none exists); **PRODUCTION** = verified on the live system. Nothing in this report is STAGING-tested. Production items are read-only checks.

## 1. Production baseline (read-only, 2026-10-15 ~02:30 IST)
- Production = `coolify-deploy` `f81fbdb` (unchanged). `crm /login` 200, `/api/backup` 401, WhatsApp webhook wrong-token 403, `booking /booking` and `/landing/home-deep-cleaning-pune`, `/landing/pest-control-services-pune` 200, www 200.
- Backup: run #86 (2026-10-14 17:40 IST) green, Drive file 5,301,551 B, **restore-drill RESTORABLE** (15 users, 227 leads …). The 02:00 IST scheduled run had not appeared yet at 02:27 IST (GitHub cron can start late; last good backup only ~9 h old, stale threshold is 26 h).
- Rollback: Coolify → application → Deployments → redeploy the previous deployment (`f81fbdb`), or revert commit on `coolify-deploy` (no force push). No schema change is part of any prepared branch, so rollback never touches data.
- No staging environment exists (one Coolify app, one environment).

## 2. Already built — do not recreate
| Capability | State |
|---|---|
| Landing/booking forms → one CRM lead | LIVE. `publicBookLead` server action; honeypot; validation; creates Lead + Customer link + follow-up + alerts |
| Source/campaign attribution | LIVE. First touch kept, latest touch updated; UTM, gclid, fbclid, landing page stored; channel derived server-side (Google Ads / Meta Ads …) |
| Duplicate rule | LIVE by design: **same mobile + same service + an open enquiry = the same lead is updated** (same LD number); same mobile + a *different* service = a new lead linked to the same customer record (no duplicate customer) |
| Sheets register | LIVE if the two env vars are set (unverified: env values are hidden from Claude) — fire-and-forget, after the CRM save |
| Email/Cognito intake | CRM endpoint LIVE; the Apps Script bridge is installed but not running (owner steps pending) |

## 3. Tested locally in this pass (scratch DB, fake tracking IDs, all outbound credentials blank, WhatsApp TEST mode) — LOCAL only
1. Google-style visit (`utm_source=google … gclid`) → form → CRM lead with source GOOGLE / channel "Google Ads", first-touch + latest-touch fields, gclid, landing page, 1 follow-up; GA4 `generate_lead` ×1 and Ads `conversion` ×1 (no double count).
2. Meta-style visit (`utm_source=meta … fbclid`) → lead with latest touch "Meta Ads / paid_social / campaign", first touch preserved from the earlier Google visit.
3. **Duplicate prevention:** same mobile + same service submitted twice → still **one** lead (LD-2026-0004), no second customer, consent not downgraded; (it adds a second follow-up task — a minor duplicate staff task, not changed because it sits in the booking action).
4. Same mobile, different service → second lead linked to the same customer (3 customers for 4 leads / 3 distinct mobiles).
5. **Optional WhatsApp consent checkbox** (branch `feat/landing-consent` `e2a79cf`): default unticked; **real click** ticked → `marketingConsent = OPTED_IN` with timestamp; unticked → `UNKNOWN`. (A first attempt showed UNKNOWN because the test tool set the checkbox without React's change event; repeating with a real click passed.) No message was sent — 4 WhatsApp rows, all CANCELLED by TEST mode.
6. Sheets retry (branch `feat/lead-sheet-retry` `2ff0a60`, §5): 5 unit tests with a fake fetch.
Not tested: any real Google/Meta click, the live site, real Sheets, real WhatsApp delivery.

## 4. Native lead forms — what is possible (research + read-only account checks)
### Google Ads lead form assets
- **Delivery to a CRM:** Google supports sending leads to a CRM by webhook (a URL plus a key you choose, with a test button in the Ads UI) or manual CSV download (last 30 days only; Google keeps leads 60 days).
- **Eligibility (Google Ads help):** good policy history, an eligible (non-sensitive) vertical, a privacy-policy link on the form; to serve the asset: a conversion-focused bidding strategy, a "Google lead form" conversion goal and responsive search ads. The $1,000 spend rule applies to Display / headline-opens-the-form placements, not to a lead form asset on Search ads.
- **Sahara today:** the account has the lead-form *asset type*; whether any lead form exists was **not verified**. The main campaign uses Maximize conversions, and the account is out of funds.
- **What Sahara OS lacks:** no endpoint for the Google webhook. **Needed (code only, ₹0):** `POST /api/webhook/google-leads` — verify the shared key (set as a Coolify secret by the owner), map the form fields (name, phone, city, service), reuse `publicBookLead`'s duplicate logic, mark source "Google Ads (lead form)", return 200 quickly. **Owner action in the Ads UI:** paste the webhook URL and key (consent step, cannot be done by Claude without the owner).
- **Blockers:** none technical; needs an approved deploy + owner entering the key.

### Meta Instant Forms (lead ads)
- **Existing (read-only, Business Suite → Instant forms for the Sahara Page):** 4 Active forms — "Sahara | Home Cleaning Instant Form | March'26" (created 2026-03-25, sharing *Restricted*), "Enquiry", "Standard form", "Contact form". **Leads count 0 on every form** — Meta keeps leads only 90 days, so any older leads have expired unless someone downloaded them. Leads Access: the Page has 2 people with access, **0 partners** (no CRM connected).
- **Free route — webhook:** subscribe the Page to the `leadgen` webhook field and fetch each lead by id. Meta docs: permissions `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads` (+ `ads_management`), `pages_manage_metadata` for webhooks; a long-lived Page token from a person who can advertise on the Page; app installed on the Page; deliveries can lag a few minutes. Not stated in the docs: whether Advanced Access/app review is needed for one's own Page (to be confirmed by a real test lead).
- **Sahara today:** the only Meta app is "Sahara OS Messaging" (published, WhatsApp use case). It would need the lead-ads/Webhooks use case added and the permissions above; this changes the app of the live WhatsApp integration → **owner approval and care** (a separate app is the safer alternative, also ₹0).
- **Sahara OS lacks:** `/api/webhook/meta-leads` (GET verify + POST with `X-Hub-Signature-256` check), a Graph fetch by `leadgen_id`, dedupe, source "Meta Ads (instant form)".
- **Manual fallback today (₹0):** download CSV from the forms page regularly and import into the CRM — works only if leads are downloaded within 90 days.
- **Recommendation:** keep landing-page forms as the primary path (already live, attributed and de-duplicated); add webhooks later only if native forms are actually used; never pay Zapier/Make/LeadsBridge (Meta suggests them, they are paid).

## 5. Google Sheets as an auxiliary register (branch `feat/lead-sheet-retry` `2ff0a60`, LOCAL-tested, not deployed)
- CRM save always happens first; the Sheets copy runs afterwards and cannot fail the lead.
- New: up to 3 attempts with 0.5 s / 2.5 s back-off (non-2xx, `{ok:false}` and timeouts count as failures); one **idempotency_key** (hash of timestamp|phone|service) reused for every attempt; after 3 failures an AuditLog row `LEAD_SHEET_COPY_FAILED` (masked phone) so the row can be added by hand.
- Optional Apps Script update (owner re-deploys it): an `idempotency_key` column and a duplicate check, so a timed-out-but-stored request is not added twice. Without it, a retried request could create a duplicate sheet row (the CRM never duplicates).
- Limits: retries are in-process — a server restart during the ~3 s retry window would drop that one copy (it would still be in the CRM; no failure row). No outbox table was added (that needs a schema change).
- Tests: 5/5 (success, retry with identical key for 500 / throw / `ok:false`, permanent failure → no throw + masked audit row, key stability, not-configured/non-Google URL → no call), `tsc` clean.

## 6. Tracking/ownership audit (unchanged; read-only; nothing contacted or changed)
GA4 (account 383708287) — administrator unknown, contact@ is not Administrator; GTM-WPM2QXCX not in Sahara's Tag Manager; Meta Pixel 1434208038106754 not accessible from Altaf's Meta login; Meta ad account 343079872519451 has only Sahara admins and sits outside the portfolio; Google Ads manager link removed. Details: `docs/OWNERSHIP_RECOVERY_PLAN.md`, task register SOS-17.

## 7. Staging options and cost
| Option | Cash cost | Notes |
|---|---|---|
| Local scratch test (what was done) | ₹0 | Not proof of production behaviour |
| Second Coolify app on the existing VPS (own empty DB volume, sslip.io hostname, no DNS) | **₹0 extra** (VPS prepaid to 2028-09-05) | Uses the same 2 vCPU / 8 GB / disk (≈23.5 of 100 GB in use): a build can slow the live CRM for minutes and adds a few GB; must never share the production DB volume. **Not created — needs your approval.** |
| Hostinger daily backups upgrade | ₹589/month | Not needed for this work; not purchased |
| New VPS | paid | Not recommended |

## 8. Costs (honest list)
- Required for this plan: **₹0.**
- Optional only if you choose them: Hostinger daily backups ₹589/month; WhatsApp live messaging is billed per message (see `docs/WHATSAPP_READINESS.md`) and the WABA already has a card on file; Google Ads / Meta spend (you decide, none started).

## 9. Permissions / approvals needed
1. Deploy of `feat/landing-consent` and `feat/lead-sheet-retry` (production change; rollback = redeploy `f81fbdb`).
2. Coolify env: Sahara tracking IDs (public) — only after the GA4/Pixel decisions.
3. Owner in the Google Ads UI: webhook URL + key (only if native lead forms are used).
4. Owner: decide whether to add the lead-ads use case to the existing Meta app or use a separate app.
5. Approval before creating the free staging app (resource risk, §7).

## 10. Next safest step
Approve one small production deploy (consent checkbox + Sheets retry; no schema/env change) with the backup-verified rollback above — or first approve the free staging app and run the same tests there. Claude will then verify with one internal test lead on the live page.

---
# 11. Decision report — pre-deployment review (2026-10-15, nothing deployed or created)

## 11.1 Diff review against production `f81fbdb` (both branches are exactly 1 commit ahead, 0 behind)
| Branch | Files | Content |
|---|---|---|
| `feat/landing-consent` `e2a79cf` | `src/components/public/category-lead-form.tsx` (+9/−1) | optional, unticked checkbox; `marketingOptIn: false` becomes a state value; same wording as the booking wizard |
| `feat/lead-sheet-retry` `2ff0a60` | `src/server/lead-sheet.ts`, `tests/lead-sheet.test.ts`, `scripts/google-sheets-lead-webhook.gs`, `package.json` (+1 script) | 3-attempt retry, idempotency key, AuditLog on final failure; tests; optional Apps Script duplicate check |
Checked: **no** prisma/schema, `db-setup`, migration, `.env`, pricing, middleware, `next.config`, lock-file or `dev.db` change; no secret (only the fake test value `unit-test-secret-not-real`); no booking/pricing logic touched. The two commits cherry-pick onto production cleanly (temporary local branch `qa/combined`).
Review notes: (a) the Apps Script change adds an `idempotency_key` column — an existing sheet's header row has only 10 columns, so the new column has no header cell (cosmetic; the duplicate check still works); (b) only an explicit `{ok:false}` from the script counts as a failure — an HTML error page with HTTP 200 is treated as success (same as before this change).

## 11.2 Tests and build (run on `qa/combined` = production + both branches, 2026-10-15)
| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean (one transient error came from a stale `.next/types` file of an earlier build; clean after rebuild) |
| `npm run build` (Next.js Turbopack production build) | exit 0, "Compiled successfully in 71s", 51/51 static pages |
| `npm run test:sheet` | 5/5 |
| `npm run test:ops` | 7/7 |
| `npm run test:inquiry` | 15/15 |
| `npm run test:eod` | 16/16 |
| `npm run test:public` | 5/5 |
| `npm run test:pricing` | 61/61 |
Plus the manual local E2E in section 3 (landing form to CRM lead, attribution, dedupe, consent checkbox). All LOCAL; no staging; no production verification.

## 11.3 VPS resources (read-only: Hostinger hPanel usage charts, Coolify server pages) — KVM 2: 2 vCPU, 8 GB RAM, 100 GB disk
| Metric | Evidence |
|---|---|
| CPU | idle baseline about **8%**; the one deploy/build seen in the last 24 h (~1 PM) peaked at about **34%** for a few minutes |
| RAM | steady **2.0–2.3 GB** of 8 GB; about 2.5 GB peak during that build (1-minute sampling, so the true build peak may be higher) |
| Disk | **about 23.5 GB of 100 GB** now; it was about 6 GB in the early morning and jumped by about **17 GB** around that build (images + build cache) |
| Docker cleanup | Coolify runs it **daily at 00:00 UTC (05:30 IST)** ("Run on every schedule") — this explains the nightly return to about 6–11 GB |
| Coolify | 1 server ("localhost"), 1 app. Server page shows **"Attention required / Changes pending – Restart Proxy"**; the Proxy page says **"Your configuration changed, please restart the proxy"**; a Traefik v3.7 update is also offered. Claude changed nothing; cause unknown. **Do not restart the proxy casually — it briefly takes every site (CRM, booking, app) offline.** |
Per-container CPU/RAM was not available without a shell; the numbers above are server-wide.

## 11.4 Can a staging app run safely on the existing VPS? — **Yes, with conditions; not created**
Expected impact of a second Coolify app: first build ≈ the same ~34% CPU spike for several minutes (the live CRM may respond slower; schedule it after ~23:00 IST), runtime RAM about 0.3–0.5 GB (estimate), disk about +3–5 GB steady and up to about +17 GB during a build until the 05:30 IST cleanup — well inside 100 GB. Cash cost ₹0 (VPS prepaid to 2028-09-05). Conditions (all must hold):
1. **Never clone the production app** — cloning copies production env vars (WhatsApp/SMS/VAPID/Sheet secrets). Create a fresh app from the repo with only: its own `DATABASE_URL` on its own new volume, a new `AUTH_SECRET` (owner-created), `OPS_REMINDERS_SCHEDULER=off`, `WHATSAPP_OUTBOUND_MODE=test`, and **no** WhatsApp/SMS/e-mail/Sheet/VAPID variables.
2. **Demo-account risk found:** a fresh database is seeded with demo users and the bootstrap passwords printed in `prisma/seed.ts` (admin Sahara1, Sahara2, Sahara3 …), and the committed `dev.db` (5 demo users, 20 staff, 24 jobs, no real customers) is copied onto an empty external volume. On a public staging URL those logins would be guessable. Mitigation: switch on Coolify's HTTP Basic Auth for the staging app, change the demo passwords at first login, keep the app stopped except while testing.
3. Do not touch the pending proxy change; a new application with a domain is normally picked up by Traefik dynamically (no proxy restart expected, but unverified until tried).
4. Staging data stays synthetic; no copy of the production database or backups.
**Decision: SAFE TO STAGE under these conditions; NOT created.** Fallback with no VPS impact: keep testing locally (what was done).

## 11.5 Google Sheets — exactly what happens on a restart (experiment)
Test: a child process starts a copy and is killed (SIGKILL, same effect as a container stop for in-flight work) while the copy is running; scratch DB, fake fetch.
| Moment of the kill | Result |
|---|---|
| attempt 1 in flight (answer never arrives) | no Sheet row, **no `LEAD_SHEET_COPY_FAILED` record** (AuditLog count 0) |
| attempt 1 failed, waiting in back-off before attempt 2/3 | no Sheet row, **no failure record** (count 0) |
| CRM lead | already committed before the copy starts — **safe** in every case |
**Remaining failure window:** from the moment the lead is committed until the copy succeeds or logs its failure — about 0.3 s normally, up to about 15 s in the worst case (3 × 4 s timeout + 0.5 s + 2.5 s back-off). A deploy/restart inside that window silently skips the Sheet row and nothing records it. The CRM is the source of truth, so no lead is lost, but the Sheet can miss a row. Closing it fully needs a persistent outbox (a schema change — deliberately not done) or a periodic CRM-to-Sheet reconciliation; a cheap interim: after each deploy, compare the Sheet row count with that day's CRM leads. A timed-out request that the Sheet did store is retried with the same key — with the updated Apps Script the duplicate is skipped; with the old script it would be added twice.

## 11.6 WhatsApp consent checkbox — facts
- **Optional:** the form submits without it (tested). **Unchecked by default:** DOM `checked=false` on page load (tested). Ticked by a real click gives `marketingConsent=OPTED_IN` + timestamp; unticked gives `UNKNOWN` (tested, scratch DB).
- Ticking sends nothing; it only stores consent. No external message was sent in any test (all 4 WhatsApp rows CANCELLED by TEST mode; Cloud API, SMS, e-mail, Sheet and VAPID variables were blank).
- Gates that stop marketing messages today (production `f81fbdb`): broadcast only to numbers with a recorded opt-in and no STOP; live campaigns need `WHATSAPP_CAMPAIGNS=on`; outbound TEST/transactional mode (the env value is not visible to Claude; the 2026-10-14 backup shows 1,488 of 1,509 messages blocked). **Not yet on production:** the extra guard inside `sendWhatsAppTemplate` (branch `feat/whatsapp-consent-guard` `38862c5`, 8 tests) that refuses any MARKETING template without a recorded opt-in even from other code paths — recommended to deploy together with the checkbox.
- Transactional booking messages (utility templates) are separate from marketing and unaffected by the checkbox.

## 11.7 Native lead forms — NOT IMPLEMENTED
Google Ads lead-form webhook and Meta Instant-Form (`leadgen`) webhook: **not implemented, not tested, no credentials or permissions granted.** They stay "possible, ₹0, pending authorized API/webhook tests" (section 4).

## 11.8 Backup / rollback readiness
Last backup #86 (2026-10-14 17:40 IST) green and restore-verified; the 02:00 IST run had not yet appeared at 02:27 IST. Rollback for any deploy: Coolify, Deployments, redeploy `f81fbdb`, or revert commit (no force push). Neither branch changes the schema, so rollback never needs a data restore.

## 11.9 Costs
Unavoidable cost for the next step: **₹0.** Not purchased: Hostinger daily backups (₹589/month), any connector/subscription, any ad spend.

## 11.10 Precise approval needed for the next step
Choose one:
- **A (recommended):** approve creating **one free staging app** on the existing VPS under the conditions in 11.4 (fresh app, no cloned env, Basic Auth, TEST mode, built after about 23:00 IST). Claude then runs the section 3 tests there and reports STAGING-verified results.
- **B:** approve a small **production deploy** of `feat/landing-consent` + `feat/lead-sheet-retry` (+ optionally `feat/whatsapp-consent-guard`), no schema/env change, rollback as in 11.8.
- **C:** do nothing yet.
