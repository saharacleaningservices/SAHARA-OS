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
| SOS-07 | Google Ads — Brand Make unlink + support | P1 | VERIFIED COMPLETE — Managers list empty, 0 pending approvals (2026-10-15) |
| SOS-08 | Meta Business assets + ads ownership | P1 | PARTIALLY COMPLETE (inventory + access audit done 2026-10-15; ad account outside portfolio; owner decisions needed) |
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
- **Done locally, NOT deployed:** backup-failure GitHub Issue alert + size-verified Drive upload (`feat/backup-alerts-workflow` `957e7f1`, now with `04aec43`; based on `main`); CRM 26-hour stale-backup alert + `/api/backup/confirm` (`feat/backup-alerts` `dfa1073`, `a5531ab`, `567f29d`, `32e0904` badge fix). Tests: `test:backup` 10/10, Python 16/16, `tsc` clean, `npm run build` ok. Read-only pre-deployment review: fast-forward safe from `f81fbdb`, no schema change.
- **BLOCKED:** pushing to `coolify-deploy` / the workflow branch was denied by the tool's production-deploy rule. Needs the owner to allow it (explicit instruction or Bash permission rule) — one decision.
- **Encryption assessment (2026-10-14, throwaway key, synthetic archive, temp files deleted):** the exact `openssl enc -aes-256-cbc -pbkdf2 -salt` commands planned for the workflow encrypt and decrypt back to a byte-identical archive; a wrong key fails (`bad decrypt`, exit 1); ciphertext is salted (`Salted__`). So the mechanism works; only the owner-held key is missing.
- **PENDING OWNER (security decisions):** (a) backup encryption key (`BACKUP_ENCRYPTION_KEY` was never created; all Drive backups are plaintext) — plan in runbook §9a; (b) second independent off-site copy — options in §9b (nothing purchased).
- **Existing second copy VERIFIED (2026-10-15, hPanel read-only):** Hostinger weekly auto-backups 2026-10-10 16:09 (52.30 GB) and 2026-10-03 10:05 (6.63 GB), restore estimate 39 min; same provider as the VPS (not independent); Disk in use ≈23.5 GB of 100 GB (hPanel usage chart; +~17 GB in one day from deploys) — the 52.30 GB is backup image size; watch, prune only with approval. GitHub Issues are enabled on the repo (0 open) so the failure-issue alert can be created. The Chrome extension was reconnected; Task 1 owner/permission blockers unchanged.
- **Retention verified (2026-10-14):** Drive holds 32 backups (30 daily + 2 monthly keepers), oldest 2026-09-30; daily tier is count-based so many manual runs shorten real history (8 Oct had ~17) — see runbook §2.
- **Prepared 2026-10-14 (local, unpushed) on `feat/backup-alerts-workflow` `04aec43`:** day-based retention (fixes the manual-run history problem; verified on the real 32-file Drive listing; 21 Python tests), encrypted copy step with decrypt round-trip proof (step logic executed locally with a throwaway key, both with and without a key), and a 30-day GitHub Actions artifact of the encrypted file as second off-site copy. Needs `BACKUP_ENCRYPTION_KEY` (owner-created) to activate. Actual second copy: **does not exist yet** (not claimed).
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
- **Re-audit 2026-10-15 (full report `docs/WHATSAPP_READINESS.md`):** 15 templates ACTIVE (Quality pending); consent re-counted from the 2026-10-14 backup — **2 OPTED_IN of 210 active leads, 0 STOP rows, customers have no consent field** (eligible promotional audience = 2); 1,488 of 1,509 logged messages were blocked by TEST mode. New guard: MARKETING-category templates refused without a recorded opt-in (branch `feat/whatsapp-consent-guard` `38862c5`, 8 tests, local only). Code references 4 templates that do not exist in Meta (`…_confirmed_v2`, `…_job_completed`, `…_customer_followup`, `…_review_request_v2`) — keep their flags off.
- **Branding (verified 2026-10-14, WhatsApp Manager, read-only):** WABA 1629093895673046 has one number, **+91 91752 20270**, display name **"Sahara Cleaning Services"**, status Connected, quality High. Customer-facing links use +91 7083347130 (owner decision 2026-10-11). The old WABA/number is never touched.
- **Green badge (Official Business Account) — eligibility only, nothing requested:** needs Cloud API (met), completed Meta Business Verification (status NOT verified here — the Business Settings pages would not render in the automation browser), and Meta's own judgement of brand "notability" (several reputable third-party news articles; paid/self-published content does not count). Meta decides, no SLA, no guarantee (vendors quote 2–8 weeks and low first-attempt pass rates — unverified). The badge itself is reported free; Meta Verified is a separate paid subscription whose WhatsApp pricing could not be confirmed. **Owner actions:** open Meta Business Settings → Security centre and tell Claude the Business Verification status; if verified, request the badge from WhatsApp Manager; a realistic fallback is the complete business profile (logo, address, website, description) which does not need the badge.
- **Campaign launch — NOT AUTHORISED:** live sends stay OFF until the owner approves; a small test audience (approved test number 9921215250) first. Guardrails: never touch the old WABA; AI/auto-replies OFF.

### SOS-06 — Cognito forms → CRM → WhatsApp · P1
- **Status: BLOCKED / PENDING OWNER (found 2026-10-14, read-only).** CRM intake `/api/webhook/email-lead` exists, fails closed (production returns 401 without the bearer token). But the **sender is missing**: the contact@ account has **no Apps Script projects**, so Cognito enquiries reach Gmail only. Gmail shows 201 Cognito threads, latest 13 Oct 2026; five consecutive enquiries from 7–13 Oct were searched in the live CRM leads list (210 leads) by name and number and **none were found** — enquiries are probably being handled outside the CRM or missed.
- **Done (local):** ready-to-install bridge `docs/cognito-email-lead.gs` on branch `feat/cognito-crm-intake` (reads only Cognito notification mails, labels processed threads `CRM-synced`, token from Script Properties; parser checked on made-up samples; no customer data in the repo).
- **Installed (2026-10-14, owner's Google session):** Apps Script project **"Sahara Cognito to CRM"** with the code saved (v2: DRY_RUN mode, CRM-skipped label, identical to the repo file; setup checklist `docs/COGNITO_CRM_SETUP_CHECKLIST.md` on `feat/cognito-crm-intake`), and non-secret property `LEAD_URL` set. **Not run** (running asks for Gmail authorisation = owner consent), **no trigger** yet, **`LEAD_TOKEN` not set**. Whether `EMAIL_LEAD_TOKEN` exists in Coolify could **not** be verified: the tool redacts any `*TOKEN` variable (the Coolify env page loaded, 10 variables) — not circumvented.
- **Owner steps (one at a time):** (1) in Coolify confirm/set `EMAIL_LEAD_TOKEN` (secret — owner only); (2) in the Apps Script project add property `LEAD_TOKEN` (same value), run `processCognitoEmails` once and approve Gmail access, add the 5-minute trigger; (3) tell Claude, who then verifies with the next real enquiry (no fake leads).
- **Priority-2 work (2026-10-14, local, not deployed):** intake tests `tests/email-lead.test.ts` (6/6: fails closed 401, validation 400, +91/0-prefixed number normalisation, no duplicate leads for the same number, service detection) and a fix so a **repeat enquiry on an open lead alerts the team** (before it was only a silent timeline note) — branch `feat/cognito-crm-intake` (`60c90a7`, now `2876e51`; based on production `f81fbdb`, not pushed; 17 tests: `npm run test:cognito`). Bridge script hardened (`docs/cognito-email-lead.gs`: 14-day back-fill, retry every 5 min, owner e-mailed once/day if the CRM cannot be reached, nothing labelled until the CRM accepted it).
- **Options compared:** (a) Apps Script on the existing Workspace mailbox — **chosen: ₹0**, uses existing services, works without any Cognito plan; (b) Cognito's own webhook — Cognito admin is not signed in in the automation browser and the plan's webhook entitlement is unverified, and it cannot send our Bearer header (would need a CRM change + deploy); (c) paid Zapier/Make-type connectors — unnecessary cost.
- **Priority-3 (WhatsApp copy of a Cognito lead to the Sahara team) — evaluated, not enabled:** the CRM already tries a WhatsApp copy to Admin and Accounts (`notify(whatsappToAdmin)` + `sendWhatsApp`); in TEST mode only the approved test number receives anything. Meta's pricing (developers.facebook.com, per-message since 1 Jul 2025): free-form messages are free only inside an open 24-hour customer-service window; a business-initiated alert to a team member outside that window needs an approved template — utility templates are charged per delivered message (third-party sources quote about ₹0.115 each; Meta's own India rate card must be confirmed before approval) and utility templates sent inside an open window are free. At ~10 leads/day × 2 people that is roughly ₹70/month, but it needs a payment method on the WABA (owner only) and LIVE mode. **Free CRM-first alternative (already in place):** in-app + push alerts to Admin/Accounts/Operations. Decision for owner: stay CRM-first (recommended now) or approve a small utility-template budget later.
- **Acceptance:** a new Cognito enquiry appears in CRM Leads within ~5 min, de-duplicated, with Admin/Accounts/Operations alerts.

### SOS-07 — Google Ads: Brand Make unlink + support · P1
**Status: PENDING OWNER PASSKEY — everything else done (2026-10-15).**
- **Pre-checks VERIFIED (read-only):** Sahara keeps its own access (1 user, 1 admin, 0 users without passkey); manager Brand Make Digital Marketing Solution (898-956-9172) linked since 2026-01-30, type Google Ads, **Owner: No**. **Billing is Sahara's own** (manual payments by Visa ending 2994; last payment ₹5,000 on 27 Jul; balance ₹0.37, funds exhausted; net cost Feb–Aug 2026 ≈ ₹107k; no spend since August). **Conversion goals live inside Sahara's account** (Submit lead form, Phone call lead – "needs attention", Contact, Get directions, Leads from messages), so unlinking does not delete them. Gmail has no Google support case; none was needed — the account admin can unlink himself.
- **Official removal started:** Access and security → Managers → "Remove access" → dialog "Unlink this account from Brand Make…" (Google states: "1 account will continue serving ads"; "Data shared from Brand Make won't be available after unlinking"; "another admin may need to approve… request expires in 20 days"). Clicking **Unlink** triggered Google's **"Confirm it's you — Confirm with a passkey"** gate. Claude stopped there (never bypassed). The dialog was left open in the automation Chrome tab.
- **Owner step (one):** in that Chrome tab press **Confirm with a passkey** and approve with your device/Windows Hello. If the dialog was closed: Google Ads → Admin → Access and security → Managers → Remove access → Unlink → Confirm with a passkey. Then tell Claude; Claude verifies the Managers list is empty and the account/conversions/billing are unchanged. If Google reports "pending approval", the request stays valid for 20 days.
- **Owner reports the passkey is forgotten (2026-10-15).** Never bypassed. Google's own "Blocked during authentication?" help lists two official routes: (1) **ask another account user** to make the change — the account has only one user, so a second admin would have to be invited first (inviting also needs the same verification); (2) **Contact us** (Google Ads support). Passkey recovery path (owner): Google's sign-in screen for contact@saharacleaningservices.com offers **"Try another way"** (password + 2-step verification) — choose that on the owner's own devices; a passkey can live on this PC (Windows Hello PIN/fingerprint), a phone (scan the QR code Windows shows) or a password manager/security key. Claude can open the support request for the owner once the owner is signed in with a method he controls; suggested wording: "I am the administrator of Google Ads customer account 988-668-0860. I need to remove manager account Brand Make Digital Marketing Solution (898-956-9172) but cannot complete passkey verification. Please advise the official verification/recovery route."
- **Not done:** unlink is **not completed** until the passkey is approved. Brand Make's Meta Ads access (if any) is a separate matter (SOS-08: no agency partner is in the Meta portfolio).

### SOS-08 — Meta Business assets + ads ownership · P1
**Status: PARTIALLY COMPLETE — ownership inventory + access audit done (read-only, 2026-10-15, owner's signed-in Meta Business Suite); Sahara-controlled setup needs owner decisions.**
- **Business portfolio "Sahara Cleaning Services"** (ID 152082702561104): created by Altaf Shaikh on 2019-09-06; legal name Sahara Cleaning Services; business phone +91 70833 47130; website https://www.saharacleaningservices.com/; **Business verification: UNVERIFIED**; Primary Page: none.
- **Owned by Sahara (in the portfolio):** Facebook Page "Sahara Cleaning Services" (ID 1880762258603818, 2 people full access, 0 partners); Instagram @saharacleaningservices.pune (ID 17841476001601525, 1 person, 0 partners); WhatsApp: production WABA 1629093895673046 (+ the Meta test WABA and a WhatsApp-Business-App account entry — not touched).
- **Not in the portfolio:** **Ad accounts: none**, **Datasets/pixels: none**, **Domains: none**, **Partners (agencies): none**. The ad account `343079872519451` that holds the 3 old campaigns is therefore **outside** the portfolio (an ad account owned by a personal profile or another portfolio) — ownership of it is unconfirmed. No agency (Brand Make) partner or person appears in the portfolio.
- **People (2):** "Sahara Cleaning Services @saharacleaningservices.pune" (full access incl. finance, last active 2026-10-06) and Altaf Shaikh (full access, active 2026-10-14). **Owner to confirm the first one is yours** (it looks like a profile created from the Instagram account).
- **Security Center — "Action needed":** no trusted domains for peer approval; **1 user without a passkey**. Done: peer approval on ad accounts, full-control users ≤ 10, two-factor authentication.
- **Billing:** ad account — funds ₹0, no payment method, no recent spend (GST verified). **The WABA has a payment method on file (VISA ending 2994)** — enabling LIVE/marketing WhatsApp sending would bill that card (see `docs/WHATSAPP_READINESS.md`). Nothing activated.
- **Old campaigns:** 3, all switched On with "Payment error" ("Keep your glass maintain and clean…", "INDEPENDENCE DAY SALE", "Sahara Cleaning Services was live."). Adding funds would let them spend immediately — review/switch off first. Not changed.
- **Safe transition plan (nothing executed):** (1) owner confirms who owns ad account 343079872519451; (2) if it is the owner's personal one, claim it into the portfolio (Business settings → Ad accounts → Add → Claim — owner approval, effectively permanent); (3) create a dataset/pixel in the portfolio and connect the domain(s) `booking.` / `www.` (domain verification needs a DNS TXT record = DNS change, owner approval); (4) add trusted domains + remove/secure the user without a passkey; (5) start Business Verification (documents are owner-only); (6) only then add a payment method and build fresh campaigns from the approved landing pages. Pixel/Conversion API on the sites is also not firing today (see digital-channel findings under SOS-14).

### SOS-09 — Staff operations + mobile QA · P1
- `STAFF_APP_DEVICE_QA.md` exists. **NOT TESTED** on real staff devices in this pass. Next: QA checklist on actual phones (attendance, job card, consent tap, sound/alerts).

### SOS-10 — Google Workspace email migration · P1
- **URGENT 2026-10-15:** Workspace Business Starter payment failed repeatedly (latest 14 Oct); Google will suspend all services for all users on **2 Nov 2026** unless the payment method is fixed (owner, Admin console > Billing). Details in the reconciliation section at the end.
- MX → Google Workspace (verified by DNS lookup 2026-10-14). No migration work verified here. **Dependencies:** SOS-12 (website hosting/cPanel mail). Security review of SPF/DKIM/DMARC not yet done.

### SOS-11 — Google Business Profile · P2
- Both listings audited (Report 3, Drive). Facts to keep: PIN 411060, phone 8956567130, established 2012; Mohammad Wadi Road is an operational office, never advertised as a customer visit location; never touch the Magarpatta profile. Corrections need the owner's Google login — **PENDING OWNER**.

### SOS-12 — Website migration to Sahara VPS · P1
- DNS 2026-10-14: `www` → 192.185.129.241 (cPanel host), `crm`/`booking`/`app` → 187.53.134.175 (VPS). Migration = DNS change → **owner approval + rollback plan required**. Not started.

### SOS-13 — Website redesign + landing pages · P1
- Landing pages exist in the CRM repo (`/landing/*`, `/offers`, category pages; commits `a24a7b7`, `461665e`…). Corporate redesign and SEO plan (Report 3) pending; homepage title issue noted (long Kharadi-only title). Depends on SOS-12 for the main site.

### SOS-14 — Google Ads + Meta Ads launch · P1
- **BLOCKED:** depends on SOS-05 (consent/tracking), SOS-07, SOS-08 and an owner-approved budget. No spend, no campaign activation without explicit approval.

- **Read-only digital-channel findings (2026-10-15, partial — P5 paused to finish Task 1 first):** (1) **No conversion/analytics tags load on the live booking site**: in a real Chrome session `window.gtag`, `window.fbq`, `dataLayer` are undefined and no Google/Meta tracking requests fire; the www WordPress homepage HTML has no GA4/Ads/GTM/Pixel either. The CRM code (`marketing-tags.tsx`) only loads tags when `NEXT_PUBLIC_GA4_ID` / `NEXT_PUBLIC_GOOGLE_ADS_ID` / `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL` / `NEXT_PUBLIC_META_PIXEL_ID` were set **at build time** — so they were not set (or the app was not rebuilt after setting). Ads launch (SOS-14) must wait for this; CRM-side lead-source attribution is unaffected. Fix = owner sets the public IDs in Coolify + redeploy (production change, approval needed). (2) Facebook page "Sahara Cleaning Services" (954 followers, phone +91 70833 47130) and Instagram saharacleaningservices.pune (85 followers, 32 posts) load and link to the website; YouTube channel and the Google review link resolve. Instagram/Facebook text claims "4.9★ Google (1,800+ reviews)" — not verified against the live GBP (Maps page did not render). (3) www homepage title is the long Kharadi-only text, no H1, no robots meta; sitemap_index.xml and robots.txt exist on www; booking site has its own sitemap/robots. Full audit report still to be written.

### SOS-17 — Brand Make ownership / access matrix (read-only, 2026-10-15)
| Asset | Confirmed owner / admin | Sahara admin? | Brand Make access | Dependencies | Sahara replacement needed? |
|---|---|---|---|---|---|
| Google Ads 988-668-0860 | Sahara (contact@, Admin since 2019-01-30, passkey on) | **Yes** | **None — manager link removed** (Managers list empty, 0 pending approvals; owner completed the passkey step) | Billing = Sahara's Visa 2994; conversion goals live in this account | No (keep). Conversion tags fire via the agency GTM (below) |
| GA4 account 383708287 "Sahara Cleaning" / property 523634206, stream G-74EZWDS33Z (stream URL `https://saharacleaningservices.in`) | Unknown administrator | **No** — contact@ has access but **not Administrator** ("cannot add/remove users") | Unverified; an unknown admin controls users | Fed by GTM-WPM2QXCX; no data in last 48 h | **Yes — get Administrator granted by the current admin, or create a Sahara-owned GA4 property** |
| GTM container GTM-WPM2QXCX | Not Sahara (contact@ sees no GTM accounts) | **No** | Most likely (agency container on the agency landing page) | Fires Sahara AW-765890204 + G-74EZWDS33Z + Clarity, Meta, DoubleClick, CallTrack | **Yes — Sahara-owned container or direct tags in Sahara OS** |
| Search Console | contact@ has **no properties** | **No** | Unknown (may be set up by someone else, or not at all) | SEO data, sitemap submission | **Yes — add a Domain property owned by contact@** (needs a DNS TXT record = owner-approved DNS change) |
| Meta Business portfolio 152082702561104 | Sahara (created by Altaf 2019) | Yes (2 full-access people) | **None** (0 partners) | Page + Instagram + WABA owned | No; finish verification/security items |
| Meta ad account 343079872519451 | Outside the portfolio; roles: "Sahara Cleaning Services" (admin) + Altaf Shaikh (admin); contact e-mail saharaenterprises161@gmail.com | **Yes** | **None found** | 3 old campaigns On/payment error; no payment method | Claim into the portfolio (owner) |
| Meta Pixel / datasets | Ad account has only the dataset "Sahara OS Messaging"; **no web Pixel**; portfolio has no datasets | — | None | Sites have no Pixel firing | **Yes — create Sahara Pixel/dataset** |
| Vercel `sahara-lp-rho` | Unknown (not visible to Sahara) | **No** | Assumed (agency build) | Hosts the landing page | **Yes — rebuild in Sahara OS** |
| EmailJS | Unknown | **No** | Unknown | SDK bundled; no visible form | Not needed if the new page posts to the CRM |
| promo.saharacleaningservices.com | Hosting unknown — Hostinger shared 82.180.143.191 (LiteSpeed); DNS A-record at Namecheap | **No** (host); DNS owner unknown | Assumed | Same page + same GTM | **Yes — replace before repointing DNS** |
**Update 2026-10-15 (recovery plan `docs/OWNERSHIP_RECOVERY_PLAN.md`):** GA4 role confirmed below Administrator (property access + product links → "Incorrect permissions"); GA4 stream URL is `saharacleaningservices.in`, no data in 48 h. GTM-WPM2QXCX v8 inventory from public gtm.js: GA4 G-74EZWDS33Z + 8 GA4 events, Ads AW-765890204 lead label `MiIICNWVx_UbEJydmu0C` + website-call label `AmE0CJ_gx_UbEJydmu0C`, Meta Pixel **1434208038106754 (not accessible to Altaf → not Sahara's)**, Clarity `veo10pku4y`. All Google Ads spend (₹81k of ₹91k, Feb–Aug 2026) landed on promo.saharacleaningservices.com. Meta ad account roles = only Sahara admins → eligible to add to the portfolio.
**Update 2026-10-15 (landing pages):** 4 Sahara-owned ad landing pages are already live on the Sahara VPS (`booking.saharacleaningservices.com/landing/*`, commit `a24a7b7`); isolated E2E test passed (attribution incl. gclid/UTM on the CRM lead, one GA4 + one Ads conversion, validation, TEST-mode WhatsApp block, no mobile overflow) — see `docs/OWNERSHIP_RECOVERY_PLAN.md` §9. Gap: tracking IDs not set in production. Fix prepared: optional consent checkbox `feat/landing-consent` `e2a79cf` (local). Correction: the Vercel page has no real mobile overflow. Coolify has no staging environment.
**Update 2026-10-15 (CRM lead capture, `docs/CRM_LEAD_CAPTURE_PLAN.md`):** LOCAL-tested (not staging, not production): landing form → one CRM lead with Google/Meta attribution, same mobile+service = same lead, optional consent checkbox (real click → OPTED_IN, unticked → UNKNOWN, no message sent), Sheets copy retry + idempotency (branch `feat/lead-sheet-retry` `2ff0a60`, 5 tests). Native forms: Google lead-form webhook and Meta `leadgen` webhook are both possible at ₹0 but Sahara OS has no endpoints yet; Meta has 4 Active Instant Forms (0 leads — 90-day expiry). No staging exists; a free second Coolify app is possible (resource risk) — needs approval.
**Update 2026-10-15 (pre-deployment review, `docs/CRM_LEAD_CAPTURE_PLAN.md` section 11):** both branches diffed against production `f81fbdb` (1 commit each; no schema/env/pricing/secret); `tsc` clean, `npm run build` ok (71 s), tests sheet 5, ops 7, inquiry 15, eod 16, public 5, pricing 61 — all LOCAL. VPS (read-only): CPU about 8% idle and about 34% during one build, RAM about 2.1 GB of 8, disk about 23.5 of 100 GB (+17 GB per build day, daily Docker cleanup 05:30 IST); Coolify shows 'proxy config changed - restart proxy' (cause unknown, not touched). Staging on the same VPS is safe only with a fresh app (never cloned), Basic Auth and TEST mode — demo seed passwords would otherwise be exposed; NOT created. Sheets restart window measured: a kill between lead commit and Sheet copy loses the Sheet row with no failure record (window up to about 15 s; CRM safe). Native Google/Meta lead forms: NOT IMPLEMENTED. Awaiting owner choice A (free staging) / B (small deploy) / C (wait).
Drive cleanup status: 17 duplicate copies created by Claude in "Sahara/Marketing Assets/Brand Make Landing Page Audit" are in Google Drive Trash (recoverable for 30 days, untouched since); 19 copies remain active (1 report, 6 inventory, 1 desktop-fold, 3 desktop-full, 2 mobile-fold, 6 mobile-full); originals also kept locally. Cleanup frozen by the owner.

### SOS-15 — Final documentation + handover · P1
- Exists: Drive Technical Master + UPDATE 1/2 + Report 3; repo `docs/DISASTER_RECOVERY_RUNBOOK.md`, `docs/BACKUP_ALERTS_ROLLOUT_PLAN.md`, this register. Remaining: merge facts into one Technical Master at the end, final consolidated report.

### SOS-16 — cPanel access audit for Brand Make (added 2026-10-14, read-only) — PENDING OWNER ACCESS
- **Blocked:** `https://saharacleaningservices.com:2083` shows the cPanel login page in the automation browser; the owner's already-open cPanel tab is outside the tab group the extension may use and cPanel sessions are bound to a tokenised URL. Claude will not ask for or enter the cPanel password. **Owner step (one):** in your cPanel tab, click the Claude extension icon and add that tab to the Claude group (or tell Claude to wait while you sign in on the tab Claude opened) — then the read-only audit (FTP/SSH accounts, subdomains, databases/users, cron, redirects, agency-named folders/landing pages) runs.
- **Live-site read-only check (2026-10-14 ~18:55 IST):** `www`/apex → 200, `booking…/` and `/booking` → 200, `crm…/login` → 200, `app…` → login 200. Nothing on the website, DNS, hosting or cPanel was changed by Claude.
- **Rules:** read-only; no website/WordPress/DNS/MX/SSL/redirect/hosting change; ambiguous or shared access is only documented; the primary cPanel password is not changed without the owner. Live website only checked read-only.

## Current git state (2026-10-14)
- Production `coolify-deploy` = `f81fbdb` (unchanged). `main` = `595d9b3` (unchanged). `coolify-deploy-current` = `aeab587` (untouched).
- Local, unpushed: `feat/backup-alerts` = `754deaf`, `dfa1073`, `a5531ab`, `567f29d`, `32e0904`; `feat/backup-alerts-workflow` = `957e7f1`, `04aec43` (own worktree `../sahara-os-wf-main`).
- Never committed: `dev.db`, `.claude/launch.json`, marketing images, `CLAUDE.md`, `SAHARA_OS_MASTER_CONTEXT.docx`, `WHATSAPP_CAMPAIGN_REVIEW.md`, `audits/`.

## Next ready work (no owner needed)
1. SOS-05: recording more marketing opt-ins needs real customer consent (owner/staff).
2. SOS-09: QA checklist for staff devices (prepare; real-device run needs people).
3. SOS-06: read-only check of the Cognito → CRM path.
4. Keep SOS-03 push blocked item visible; resume the moment the owner permits.

## SEO / AEO / GEO audit (2026-10-15)
First audit report saved in docs/SEO_GROWTH_AUDIT_2026-10-15.md. Status: audit done (read-only); GA4/Search Console/GBP blocked; all fixes proposed, awaiting owner approval. Nothing deployed or published.

### SEO phase 2 (2026-10-15)
Docs/SEO_GROWTH_AUDIT_2026-10-15.md sections 11-18: Lighthouse causes, 78-page locality matrix (R7/I19/C34/X18, provisional), H1/alt proposals, tag-loading findings (IDs unset; Dockerfile has no NEXT_PUBLIC ARG - unverified in Coolify), Search Console options, local plan, staging review. Status: analysis only, Proposed / Requires owner approval. Nothing deployed or changed live.

### SEO phase 3 - local technical work (2026-10-15, uncommitted)
Dockerfile NEXT_PUBLIC ARG lines, `npm run test:seo` (tests/seo.test.ts, 10/10), hub JS analysis (456 KiB of 913 KiB is the Google Maps footer embed), webpack-dev 500 diagnosed (use `npm run dev`). Details: docs/SEO_GROWTH_AUDIT_2026-10-15.md sections 19-22. Status: In progress (local only); not deployed. Map facade / lazy wizard = Proposed; tracking IDs, DNS, WordPress, deploy = Requires owner approval.

### SEO phase 4 - map-on-tap (2026-10-15)
Footer Google Maps iframe replaced by tap-to-load card (src/components/public/map-on-tap.tsx, campaign-kit.tsx). Measured locally (5+5 Lighthouse runs): requests 42->24, transfer 925->468 KiB, Maps 458 KiB->0; LCP median 6.65->3.53 s (lab, indicative). test:seo 11/11, existing suites + tsc + build pass. Wizard lazy-loading evaluated and rejected (gain <=19 KiB gzip, SSR/conversion risk). Status: Completed and verified LOCALLY; committed locally, NOT pushed, NOT deployed. Requires owner approval: push and production deploy. See docs/SEO_GROWTH_AUDIT_2026-10-15.md sections 23-26.

## Workstream reconciliation — master task control (2026-10-15, evidence from live read-only checks today)
Status labels: Completed & Verified · Partially Completed · Local Only — Not Deployed · In Progress · Blocked · Awaiting Owner Approval. Maps the six priority workstreams onto the existing SOS items (no new task list).
| Workstream | SOS items | Status | Evidence (2026-10-15) | Next action |
|---|---|---|---|---|
| 1 Backup & DR | SOS-03, SOS-04 | **Partially Completed** | GitHub Actions "Sahara OS Enterprise Backup": 87 runs, #87 (scheduled) + #86/#85/#84 completed successfully; real restore + verify done earlier; Hostinger weekly backups verified. Alerts/retention/encryption code = **Local Only — Not Deployed**; encryption key + 2nd off-site copy = **Awaiting Owner Approval** | Owner: push approval for backup branches; create `BACKUP_ENCRYPTION_KEY` |
| 2 WhatsApp promotional | SOS-05 | **Awaiting Owner Approval** (launch blocked by consent) | WhatsApp Manager read-only: number +91 91752 20270, display name "Sahara Cleaning Services", Connected, quality High; messaging limit tier 250 business-initiated conversations / 24 h; 15 templates Active (5 Marketing incl. `sahara_diwali_festival_offer`, `sahara_festival_offer`, `sahara_customer_reactivation`); no Meta campaigns created; "Sahara Marketing" not found in WhatsApp Manager, number profile, WABA list or Meta app ("Sahara OS Messaging"), only a historical code comment | See WhatsApp block below |
| 3 Landing pages + own ad accounts | SOS-13, SOS-07, SOS-08 | **Partially Completed** | 4 landing pages live, noindex by design; speed/SEO audit and map-on-tap done; Google Ads manager link removed (Completed & Verified); Meta ad account outside portfolio (Awaiting Owner Approval); consent checkbox + Sheets retry = **Local Only — Not Deployed** | Owner: deploy decision (A/B/C) |
| 4 Cognito → CRM + email | SOS-06 | **Blocked** (owner steps) | Apps Script installed but not run/triggered, `LEAD_TOKEN` unset; CRM intake fails closed; retry/dedupe/alert code = Local Only — Not Deployed | Owner: set token, authorise Gmail, add trigger |
| 5 Google/Meta ads audit + new structure | SOS-14 (SOS-07/08) | **In Progress** | Google Ads (read-only) — see below | Finish Meta campaign history; propose structure after tracking fixed |
| 6 Google Workspace cost/migration | SOS-10 | **In Progress / Blocked** — **URGENT** | Gmail billing mails: Workspace **Business Starter** payment **failed** 17 Aug, 25 Aug, 20 Sep, 28 Sep and **14 Oct 2026**; Google states **all services for all users will be suspended on 2 Nov 2026** unless the payment method is fixed; partial payments received ₹500 (31 Aug) and ₹300 (4 Oct). Admin console needs a fresh passkey sign-in (not attempted) so users/storage/plan count are unverified | **Owner: fix payment method in Admin console before 2 Nov**; no migration, cancel, DNS or MX change |

### WhatsApp (workstream 2) — facts
- **Sender identity:** customer-facing name = display name **"Sahara Cleaning Services"** on +91 91752 20270 (the Cloud API number); WABA "Sahara Cleaning Services" (1629093895673046). Business profile: category Professional Services, description set ("Professional home cleaning, commercial cleaning, pest control and interior painting across Pune & PCMC since 2012…"); **address, e-mail, website empty; no Facebook Page / Instagram connected to the number; profile picture not confirmed** — completing these is free and raises trust. A second WABA also named "Sahara Cleaning Services" (the old +91 7083347130 account) exists and is **not touched**; plus a Meta test WABA. **"Sahara Marketing" could not be reproduced in any Meta asset**; the only mention is an old code comment calling the Cloud API number the "Sahara Marketing number". Likely places a customer sees another name: a phone contact saved by the owner, or an unlinked number showing only digits. Owner: send one screenshot of where it appears.
- **Template (reuse, do not duplicate):** `sahara_diwali_festival_offer`, Marketing, English, ACTIVE (quality pending). Header IMAGE (Diwali banner); body: "Hi {{1}}, Diwali is around the corner! 🪔 Get your home & office sparkling clean 🧹 with Sahara's Special Festival Offers.  ✨ 100% In-House Verified Staff ✨ Transparent Pricing & Pay After Service"; buttons: "Book Festival Clean" (URL → /offers with UTM) and quick reply "Stop promotions". It names no discount (festival prices are at or above regular prices — never say "save"). Alternatives already ACTIVE: `sahara_festival_offer` (from-price variable), `sahara_customer_reactivation`.
- **Test status:** none sent (TEST mode, owner-gated). **Smallest controlled test (needs owner login to CRM, one marketing message to 9921215250, charged at Meta's marketing rate — roughly ₹0.8–0.9 per third-party sources, confirm in Meta rate card):** Admin → Marketing → WhatsApp Broadcast → TEST; expect SENT → DELIVERED; reply STOP then START; repeat the same campaign name to see duplicate prevention.
- **What prevents launch:** (1) consent: only 2 opted-in numbers; (2) `WHATSAPP_CAMPAIGNS` live switch off and outbound in TEST/transactional mode; (3) payment method on the WABA not confirmed (needed for marketing charges); (4) landing-form consent checkbox not yet deployed (Local Only); (5) tier 250 conversations/24 h caps any first send anyway.
- **Minimum steps:** record genuine opt-ins (deploy `feat/landing-consent`, staff one-tap consent) → owner approves test cost → run the TEST above → owner approves LIVE + budget → pilot to 10–20 opted-in contacts.

### Google Ads (workstream 5) — read-only, account "Sahara Cleaning", Feb 1–Aug 31 2026 view
5 campaigns; only **"Home Cleaning Search Camapign | Pune | Feb'26"** has data and is **Eligible (enabled)**: budget ₹620/day, Maximize conversions, cost **₹90,963**, 6,011 clicks, 36,425 impressions (CTR 16.5 %), reported **1,908 conversions** (31.7 % conversion rate, ₹47.67 per conversion). The other four are Paused with zero spend ("Cleaning services" ₹2,000/day paused, some ads disapproved). Account alert: **"Balance exhausted"** — a payment is needed for ads to keep running. **Conversions are not genuine enquiries:** by goal, "Phone call leads" = **1,590** of ~1,910 results, "Submit lead forms" 243, "Leads from messages" 79; the CRM holds about 210 active leads from all sources in total. A 31.7 % click→conversion rate with Maximize conversions is a measurement problem (call/click actions counted as conversions), so cost per conversion (₹47.67) is meaningless; true cost per qualified lead/booking cannot be computed until tracking is fixed. Not done yet: keywords/negatives/geo, ad copy, Business Profile/Maps placements (Google Business Profile itself cannot be sponsored directly — Maps ads run through Search/Performance Max with location assets; eligibility to be verified in the account), Meta history. **Decision for owner (not touched by Claude):** the Eligible campaign — whether it should keep running while conversions are unreliable.

### SOS-05 update - final WhatsApp launch package (2026-10-15)
Review-ready package appended to docs/WHATSAPP_READINESS.md (sections A-I). Verified live: sender 'Sahara Cleaning Services' +91 91752 20270 (High), template sahara_diwali_festival_offer ACTIVE (ID 3222923661234943), card on file, balance Rs 8.63, limit 250/24h; 'Sahara Marketing' not found in any Meta asset. Local Only - Not Deployed: branch qa/whatsapp-launch (consent guard + delivery log + landing consent checkbox + opt-out tests; tsc + 6 suites pass). Awaiting Owner Approval: deployment, TEST send (~Rs 1), later pilot. Nothing sent, deployed, changed or paid.

## Task 1–9 crosswalk and status — 2026-10-16
**Numbering:** the canonical IDs stay SOS-01…SOS-15 (owner's original "Task 01–15"). No repository document
contains a "Task 1–9" list. Two 1–9 numberings appear only in chat prompts and they conflict (16 Oct prompt A:
1 Backup, 4/8 Google Ads, 5 Cognito, 7 landing prices, 9 VPS/SEO; prompt B: 2 = WhatsApp promo template + a
workstream list). The 15 Oct workstream table above uses a third 1–6 numbering. Mapping below uses prompt B's
workstream order; the SOS ID is authoritative.

| # | Workstream | SOS | Status (16 Oct) | Evidence today | Next action |
|---|---|---|---|---|---|
| 1 | Backup & DR | SOS-03 | **CODE COMPLETE — PRODUCTION VERIFICATION PENDING** | Scheduled backups green on `main` (#88 scheduled, due 02:00 IST, started 04:38 IST); `BACKUP_ENCRYPTION_KEY` **not set** (secret names checked); PR #4 open → `main`, 3 commits/5 files, no conflicts; 22/22 workflow tests, `test:backup` 10/10; local encrypt→decrypt byte-identical, wrong key rejected, restore drill RESTORABLE | Owner adds secret → merges PR #4 → Claude checks next run log |
| 2 | WhatsApp marketing promotion template | SOS-05 | **BLOCKED — consent + owner switches** | Template `sahara_diwali_festival_offer` ACTIVE (provider evidence 15 Oct); eligible opted-in = **2**; consent capture undeployed. New branch `qa/whatsapp-launch-v2` = production `ccdd93d` + consent guard/opt-out tests/landing consent/delivery receipts; +3 tests (Meta signature 401/200, "Stop promotions" → OPTED_OUT, unknown number safe): whatsapp 11/11, ops 7/7, inquiry 15/15, eod 16/16, public 5/5, pricing 61/61 | Owner decides deploy of `qa/whatsapp-launch-v2`; confirm QA test number (9921215250 is also on the protected list) |
| 3 | Direct inquiry, CRM & staff workflow | SOS-02 | **CODE COMPLETE — REAL-DEVICE CHECK PENDING** | Live since `f81fbdb`; `test:inquiry` 15/15 | Shoyab/Francis acknowledge a real inquiry on their phones |
| 4 | WhatsApp webhook, template & customer actions | SOS-05 | **CODE COMPLETE (TEST mode)** | Webhook verifies `X-Hub-Signature-256` (constant time), fails closed in production; Pay After Service / Stop promotions handlers tested | Controlled TEST send (owner present) |
| 5 | Cognito lead intake | SOS-06 | **CODE COMPLETE — BLOCKED on owner steps** | `feat/cognito-hmac` `2431caf`: optional HMAC (`X-Sahara-Signature`), constant-time token, phone-or-email de-dup; 25/25, tsc 0, eslint 0 | Owner sets `EMAIL_LEAD_TOKEN` (+ optional HMAC secret) and runs/triggers the Apps Script |
| 6 | Google Ads / Brand Make access | SOS-07 | **PASS — VERIFIED COMPLETE** (15 Oct) | Managers list empty, 0 pending; negatives + attribution plan in `ads-audit-east-pune.md` | Monthly access check; no spend without approval |
| 7 | Meta Ads audit | SOS-08 | **PARTIALLY COMPLETE — owner decisions** | Inventory/access audit done 15 Oct | Owner confirms the second full-access person; ad-account ownership |
| 8 | Staff operations & role permissions | SOS-09 | **CODE COMPLETE — REAL-DEVICE QA PENDING** | `test/role-permissions` `dc6c9e2`: 9/9 matrix incl. typo guard; dashboard roles browser-tested 15 Oct (Francis payload has no money) | Real-phone QA with Shoyab/Francis/one staff member |
| 9 | Website SEO, redesign/migration, VPS | SOS-12/13 | **PARTIALLY COMPLETE** | booking. SEO 100 / perf 70 (mobile); WordPress perf 66, CWV failed; "0+ Years" = Elementor counter (owner steps in `MAIN_WEBSITE_TECH_SEO_2026-10-16.md`); `feat/public-site-fixes` (festival wording guard + logo 85.8→29.1 KB, pricing 63/63) | Owner/web admin fixes counters; decide VPS migration; deploy public fixes |

Out of scope by owner instruction: routine Google Business Profile work, manual social posting, WhatsApp Business catalogue.
Pricing note: CLAUDE.md records the owner removed the ₹3,999 minimum on 2026-10-10 — not reintroduced.

### Update 2026-10-16 (later) — verified state, new work, blockers
**Repository state (git, verified):** production `coolify-deploy` = `ccdd93d` (unchanged); `main` = `595d9b3`.
On GitHub: `feat/backup-alerts-workflow` `04aec43`, `feat/cognito-hmac` `2431caf`, `feat/public-site-fixes` `b641d97`,
`feat/mobile-header-56` `233448a`, `test/role-permissions` `dc6c9e2`, `qa/whatsapp-launch-v2` `1db01a8`.
PRs (from `refs/pull/*`): #3 dashboard (merged), **#4 backup → main (open)**. **No PR #5 exists** — the role-permissions
PR was never created; the other branches have no PR yet. GitHub CLI is not installed, so PRs are opened by the owner
(compare links) or after the owner installs/authorises `gh`.

**New today**
- `feat/public-site-fixes` `b641d97`: booking.* home now reaches `/booking` in one redirect (was `/ → /book → /booking`);
  `tests/booking-host.test.ts` (`npm run test:domains`) 4/4, proven to fail on the old code; pricing 63/63, tsc 0, eslint 0.
- PR #4 reviewed: 5 files (+456/−43); least-privilege permissions (contents: read, issues: write); no secret is printed;
  official actions only; secrets used: BACKUP_URL, BACKUP_TOKEN, GDRIVE_CREDENTIALS, GDRIVE_FOLDER_ID (all set) +
  **BACKUP_ENCRYPTION_KEY (not set)**. Repository has no required PR checks. Decision: add the key, then merge.
- `docs/URGENT_OWNER_ACTIONS_2026-10-16.md`: exact steps for the Workspace payment and the website certificate.
- Main website certificate re-checked: wildcard `*.saharacleaningservices.com`, issued 3 Aug, **expires 1 Nov 11:01 GMT**,
  not renewed by 16 Oct (normal renewal ≈30 days before) → automatic renewal probably failing. Host 192.185.129.241 (cPanel).
- `feat/backup-alerts` (this register's branch) pushed to GitHub as a backup — it held 34 commits that existed only on
  this PC (docs plus backup-health / backup-confirm / map-on-tap code from earlier sessions). Secret scan: clean.

**Blocked (owner) — priority order**
1. Google Workspace payment (suspension 2 Nov) — admin.google.com billing.
2. Main site certificate (expires 1 Nov) — cPanel AutoSSL / hosting provider.
3. `BACKUP_ENCRYPTION_KEY` secret → then merge PR #4.
4. WhatsApp: confirm the QA test recipient (9921215250 is on the protected list) and decide deployment of
   `qa/whatsapp-launch-v2`; LIVE stays off (2 opted-in contacts).
5. Cognito: `EMAIL_LEAD_TOKEN` in Coolify + Apps Script property/trigger.
6. Open PRs for the five branches, or install/authorise GitHub CLI so Claude can.
7. Real-device QA (Shoyab, Francis, one field staff) for SOS-02 / SOS-09.

### Update 2026-10-16 (release) — PR #5 ready to merge
- **PR #5** `release/2026-10-16` → `coolify-deploy` (created via GitHub REST API; `411879c`; 52 commits / 38 files; GitHub:
  mergeable, clean; repo has no CI checks). Contains: backup confirm endpoint + stale-backup alert (`feat/backup-alerts`),
  Cognito HMAC/de-dup (`feat/cognito-hmac` `2431caf`), landing/SEO/perf (`feat/public-site-fixes` `a4f2d00`), mobile header
  (`feat/mobile-header-56` `233448a`), role-permission tests (`test/role-permissions` `dc6c9e2`). Excludes `qa/whatsapp-launch-v2`.
- New in this pass (`feat/public-site-fixes`): `95971b3` service-hub hero via next/image (phones ~30 KB vs 145 KB);
  `a4f2d00` booking.* unknown/CRM paths → **true 404** (owner rule 2026-10-16; was a redirect to /booking).
- Evidence on the release branch: production `npm run build` exit 0; tests cognito 25, pricing 63, domains 4, roles 9,
  public 5, ops 7, inquiry 15, backup 10, eod 16, seo 11 (built app) — all pass; tsc 0; eslint 0 errors (13 old warnings).
  Built app with the real host split: booking `/`→`/booking`; public pages 200; unknown, /dashboard, /login, /llms.txt,
  /ai-catalog.json, missing image → 404; crm signed-out → /login.
- PR #4 re-checked: still 5 backup-workflow files only (incl. `.gitignore` python cache), mergeable/clean.
- **Status:** SOS-03 CRM side, SOS-06 code, SOS-09 tests, SOS-13 fixes = CODE COMPLETE — DEPLOYMENT PENDING (merge PR #5).
- **Not live** until merged + Coolify build + live check (steps in the PR description).

### Update 2026-10-16 (Stage 5) — e-mail DNS, ads doc
- **SOS-10:** read-only DNS: MX already Google Workspace → **no MX cutover needed** (and the register's rule "no MX change"
  stands). Findings: SPF lacks `include:_spf.google.com`; no DKIM (`google._domainkey`); no DMARC. DNS host is
  **Namecheap**, not cPanel. Owner runbook: `docs/WORKSPACE_EMAIL_DNS_RUNBOOK.md` (SPF edit, DKIM via Admin console,
  DMARC p=none, verify, rollback). Do after the Workspace payment is fixed. Status: BLOCKED — owner DNS/Admin action.
- **SOS-07/14:** ads doc renamed to `docs/ads-audit-east-pune.md` (Brand Make removal verified 15 Oct; negatives;
  Presence-only targeting for 5 East Pune zones; UTM→CRM attribution map). No change made in Google Ads.
- Certificate note updated: wildcard cannot auto-renew from cPanel while DNS is at Namecheap → use AutoSSL for
  domain + www (HTTP validation).
- Stages 1–4 re-confirmed by state, not re-run: branches unchanged since the full verification on `release/2026-10-16`
  `411879c` (build exit 0, all suites green, seo 11/11); PR #4 and PR #5 open, mergeable.

### Update 2026-10-16 (Meta / WhatsApp consent)
- `docs/META_BUSINESS_GREEN_TICK_SETUP.md`: owned ad account (switch old campaigns Off → check owner of
  343079872519451 → claim only if Altaf's own, else create new INR/Asia-Kolkata account), Business Verification,
  green-tick eligibility from Meta's current developer docs (30 days on platform, verified portfolio, 2-step
  verification, approved display name; API numbers only — native app line not eligible), compliant opt-in plan.
- **Declined (policy):** sending an opt-in or "utility" broadcast to the ~4,295 non-consented contacts — WhatsApp
  requires opt-in *before* any business-initiated message. Opt-in to be collected via forms (built,
  `qa/whatsapp-launch-v2`), job-card consent, inbound chats, SMS (DLT) / e-mail. LIVE stays off.
- Stages 1–3 unchanged (verified state; PR #4 and #5 open, mergeable).

### Update 2026-10-16 (fresh re-verification, no code change)
- S1 `04aec43`: workflow tests 22/22; AES-256 round-trip byte-identical; restore drill RESTORABLE. PR #4 open, mergeable.
- S2 `2431caf`: test:cognito 25/25.
- S3 `a4f2d00`: test:domains 4/4; logo 29,063 B; test:pricing 63/63 on 6 of 7 runs this pass.
- S4 `1db01a8`: test:whatsapp 11/11.
- Release `411879c`: production build exit 0 (compiled in 71 s); test:seo 11/11. PR #5 open, mergeable.
- **Known flaky test:** `tests/pricing.test.ts` "staff app (real DB) …" failed 2 of ~12 runs, each time the first run on a
  freshly linked node_modules (cold cache); 3 parallel runs under load all passed. Not reproduced, root cause unknown —
  next failure should be captured with full output before changing the test. Not a product defect signal so far.
- S5 docs present on `feat/backup-alerts`: META_BUSINESS_GREEN_TICK_SETUP.md, WORKSPACE_EMAIL_DNS_RUNBOOK.md,
  ads-audit-east-pune.md. Brand Make removal: SOS-07 VERIFIED COMPLETE (15 Oct).

### Update 2026-10-16 (evening) — website audit, Brand Make page, WhatsApp profile
- `docs/WEBSITE_SPEED_AND_SEO_AUDIT.md` (read-only): TTFB **5.8 s cold / ~1.7 s warm**, no page cache, HTTP/1.1,
  45 stylesheets + 22 scripts, 4 Elementor add-on packs, all Roboto weights; SEO: **no H1**, keyword-stuffed
  Kharadi-only title, Organization-only schema; Yoast/sitemap/robots OK. Prioritised fixes for the website admin.
- **Brand Make page = `promo.saharacleaningservices.com` on a different server (82.180.143.191)**, not in Sahara's
  cPanel — nothing to delete there. Only a Namecheap A record; page loads GTM-WPM2QXCX (owner unknown). Safe order:
  save a copy → move Google Ads final URLs to booking `/landing/*` (after PR #5 live) → repoint `promo` to the VPS with a
  301 (recommended) or delete the record. Nothing changed.
- WhatsApp template structure verified in code (`qa/whatsapp-launch-v2`): image header, body variables, URL button;
  marketing templates blocked without recorded opt-in. **Risk:** `WHATSAPP_TEST_MODE_NUMBERS` still contains
  9921215250 (owner's protected list) — owner must name another test number before any TEST send.
- META doc: green-tick readiness checklist + WhatsApp business-profile values (owner sets them; needs Meta login).
- Not done (needs owner access): cPanel/WordPress changes, Namecheap DNS changes, WhatsApp Manager profile, Apps Script
  installation (script + HMAC ready in `feat/cognito-hmac`, in PR #5).

### Update 2026-10-16 (night)
- **PR #5 merge attempted via GitHub API on the owner's instruction — blocked by the session safety guard
  ("Production Deploy").** Not retried through another route. Production remains `ccdd93d`.
- `BACKUP_ENCRYPTION_KEY` not set by Claude (key would have to be shown to the owner → secret in chat); PR #4 not merged
  (owner's condition: key first).
- WhatsApp test number → 9800817070: code change **blocked by the safety guard ("Real-World Transactions")**; nothing
  created. Code still uses protected 9921215250 (production `src/lib/whatsapp.ts:89`, `src/server/whatsapp-audience.ts:76`).
- New **PR #6** `perf/static-asset-cache` `dae9a94`: 1-day public cache for /brand, /marketing, /logo (were max-age=0);
  test:cache 3/3, tsc 0, eslint 0; no overlap with PR #5.
- Master status report: `docs/SAHARA_OS_MASTER_STATUS_REPORT.md` + one-click `SAHARA_OS_MASTER_STATUS_REPORT.html`.
