# SAHARA MASTER SYSTEM RECORD

Business operations record for Sahara Cleaning Services — Sahara OS (CRM + Staff App + Booking + WhatsApp).
Last updated: 2026-10-04.

> **Security rule for this file:** it must never contain an access token, App Secret, webhook verify token,
> password, OTP or payment detail. Secrets are recorded only as *variable name + where it is stored + status*.

---

## 1. Production system

| Item | Value |
|---|---|
| CRM (office) | https://crm.saharacleaningservices.com (same app also on https://app.saharacleaningservices.com) |
| Staff App (PWA) | https://app.saharacleaningservices.com/my — install as "Sahara Staff" |
| Public booking | https://app.saharacleaningservices.com/booking |
| Customer booking page | `/booking/<secret token>` (link sent in WhatsApp) |
| Hosting | Hostinger VPS, Docker app managed by **Coolify** |
| Code | GitHub `saharacleaningservices/SAHARA-OS` (private) |
| Deploy | push to branch **`coolify-deploy`** → Coolify auto-builds (~5 min) |
| Database | SQLite on the Coolify persistent volume (`DATABASE_URL`); schema changes applied automatically on boot by `scripts/db-setup.mjs` (additive only) |
| Time zone | `TZ=Asia/Kolkata` (Dockerfile) |
| Backups | Daily GitHub Actions → owner Google Drive (02:00 IST); manual: CRM → Settings → System Recovery Backup |

### Recent production commits (branch `coolify-deploy`)
| Commit | What |
|---|---|
| `4eb5554` | Staff App (PWA), owner preview, team incentive, Export Center |
| `dc55305` | Staff App final QA: full job scope for crew, no customer mobile for staff, hi-res salary-slip logo |
| `fdee95f` | Customer booking page: package, approved scope, address, price, terms |
| see §9 | `/j/` booking-page privacy fix + this record |

---

## 2. Meta / WhatsApp Cloud API

| Item | Value |
|---|---|
| Meta Business (Business Manager) ID | 152082702561104 |
| Meta App ID | 1569646490957820 |
| **Production WABA ID** | **1629093895673046** |
| **Production phone number** | **+91 9175220270** |
| **Phone Number ID** | **1278812171990562** |
| System user | "Sahara OS API" (ID 61595084843977, Employee) — assets: the app + production WABA only |
| Test WABA (Meta sandbox) | 1517484620417215 — not used in production |
| **Old number / WABA — NEVER TOUCH** | +91 7083347130 / WABA 108381505270532 (WhatsApp Business app) |
| Webhook callback URL | `https://crm.saharacleaningservices.com/api/webhooks/whatsapp` |
| Webhook fields | `messages` |
| Test numbers allowed | 9921215250 only |

### Approved templates (production WABA, verified in WhatsApp Manager 2026-10-04)
| Template | Category | Status | Used for |
|---|---|---|---|
| `sahara_booking_request_received` | Utility | Active | Online booking request received |
| `sahara_booking_confirmed` (ID 4410633505915346) | Utility | Active | Booking confirmed (online + CRM) |
| `sahara_review_request` | Utility | Approved | Review request after completion |
| `sahara_festival_offer` | Marketing | Approved | Festival campaign (manual, Admin only) |
| `sahara_test_booking` | — | Approved | Single go-live test |

`sahara_booking_confirmed` buttons (approved, in this order — **do not change without re-approval**):
1. **View Booking** — URL, dynamic suffix = booking token → `/booking/<token>`
2. **Pay Advance** — URL, dynamic suffix = `<token>?pay=advance`
3. **Pay After Service** — quick reply
4. **Google Review** — quick reply

Body variables: {{1}} name, {{2}} booking ID, {{3}} service, {{4}} date, {{5}} time, {{6}} area.
Code: `src/lib/whatsapp-cloud-templates.ts`, sender `src/server/booking-messages.ts`.

---

## 3. Environment variables (Coolify → Sahara OS app → Environment)

Values are **never** written here. Status as of 2026-10-04 22:00 IST (production redeployed with these at ~21:45 IST; CRM Settings shows **WhatsApp Cloud API: Connected · env**).

| Variable | Secret? | Value / purpose | Status |
|---|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | **SECRET** | System-user permanent token (Sahara OS API) | **SET by Altaf** (Coolify) |
| `WHATSAPP_APP_SECRET` | **SECRET** | Meta App 1569646490957820 → App settings → Basic → App Secret (verifies webhook signatures) | **SET by Altaf** (Coolify) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | **SECRET** | Any long random string; same value pasted in Meta webhook config | **SET by Altaf** (Coolify + Meta) |
| `WHATSAPP_PHONE_NUMBER_ID` | no | `1278812171990562` | **SET** 2026-10-04 |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | no | `1629093895673046` | **SET** 2026-10-04 |
| `WHATSAPP_USE_TEMPLATES` | no | `on` — booking messages use approved templates | **SET** 2026-10-04 |
| `WHATSAPP_BOOKING_CHANGE_NOTICES` | no | `on` only if customers should get reschedule/cancel notices | Optional |
| `WHATSAPP_CAMPAIGNS` | no | **leave unset/OFF** — live festival sends blocked | OFF |
| `WHATSAPP_AUTO_REPLIES` | no | **leave unset/OFF** — no automatic replies to inbound messages | OFF |
| `WHATSAPP_AI_ENABLED` | no | **leave unset/OFF** — AI assistant replies | OFF |
| `WHATSAPP_API_VERSION` | no | optional (default `v21.0`) | default |
| `AUTH_SECRET` | **SECRET** | session signing (existing) | set |
| `DATABASE_URL` | no | persistent volume path (existing) | set |
| `TZ` | no | `Asia/Kolkata` (Dockerfile) | set |

Alternative secret storage: CRM → Settings → Integrations can hold the WhatsApp token (encrypted at rest with `AUTH_SECRET`). Use one place only.

Staff App push notifications: VAPID keys are generated automatically and stored encrypted in the database (no env needed; optional `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`).

---

## 4. CRM ↔ WhatsApp integration (how it works)

| Flow | Trigger | Message |
|---|---|---|
| Online booking request | customer submits /booking form | `sahara_booking_request_received` |
| Booking confirmed | office confirms an online request, or creates a job in CRM | `sahara_booking_confirmed` with View Booking / Pay Advance links |
| Customer booking page | `/booking/<token>` | name, booking ID, package, approved scope + not included, services included, date/time, full address, total price, payment status, pay options, change request, terms — **no staff names, phone or internal notes** |
| Review request | job completed | review message |
| Festival campaign | Admin → Marketing → WhatsApp campaign panel | Test → QA numbers only. Live → only opted-in contacts, max 300/click, once per campaign, audit-logged, and **only if `WHATSAPP_CAMPAIGNS=on`** |
| Inbound messages | webhook | creates lead + follow-up + office alert; **no auto-reply** unless `WHATSAPP_AUTO_REPLIES=on` |

Webhook security: GET handshake requires `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (wrong token → 403, verified live 2026-10-04); POST requires a valid `X-Hub-Signature-256` from `WHATSAPP_APP_SECRET`.

Festival price: the `{{3}}` price comes from the CRM pricing master (`HOME_FROM_PRICE`). Regular pricing is unchanged. A manual price box in the campaign panel does not exist yet.

---

## 5. Staff App (live)

- Login: registered **mobile number + unique 4-digit PIN** (created per staff from Staff → staff record → *Staff App access*; PIN shown once, stored only as a bcrypt hash).
- Staff change their own PIN in the app; **Forgot PIN** → `/staff-reset` → approved by Super Admin or Accounts on the staff record.
- Staff see only their own data: jobs (package, scope, not included, customer name, date/time, full address — **never customer phone or price**), calendar, attendance, salary/advance/fine/reward, slips, team incentives, announcements.
- Owner: Staff record → **Preview Staff App** (read-only, audit-logged).
- Accounts (Shoyab): approve PIN resets, Export Center, Announcements; no Staff App preview.
- Notifications: free Web Push; iPhone needs Add to Home Screen (iOS 16.4+).
- ₹50 team incentive: one total per completed job + team (never split).
- Salary paid = Expenses → category *Salary Paid* linked to the staff member.
- Export Center: Reports → Export Center (month/year Excel; reconciles with Profit dashboard).
- QA checklist: `STAFF_APP_DEVICE_QA.md`.

---

## 6. Security notes

- `/booking/<token>` is the only customer data page reachable from WhatsApp (unguessable token).
- `/j/<jobNumber>` (legacy, guessable) now shows customer data **only with `?t=<booking token>`**; without it a neutral "open your WhatsApp link" page is shown. Older free-text messages that link to plain `/j/JOB-…` therefore show that neutral page.
- Customer mobile numbers are never sent to STAFF logins (Staff App, job page, jobs list).
- No secrets in git, logs or this file.

---

## 7. Testing results (2026-10-04)

| Area | Result |
|---|---|
| Staff App build / typecheck / lint | PASS |
| Staff login, PIN change, Forgot-PIN approval (Admin + Accounts) | PASS (local + deployed) |
| No duplicate notifications | PASS |
| Staff data isolation / no customer phone / no prices | PASS |
| Export vs Profit dashboard | PASS (matches) |
| Salary slip hi-res logo | PASS |
| Customer booking page content | PASS (local); live after deploy |
| Webhook endpoint live, wrong token rejected | PASS |
| Template/button mapping vs approved Meta template | PASS |
| Coolify env (5 of 6 WhatsApp vars) + redeploy | DONE 2026-10-04 ~21:45 IST |
| CRM WhatsApp status | Connected · env |
| Meta webhook registration | DONE — callback saved/verified (Altaf); **messages** field subscribed 2026-10-04 23:59 IST |
| Webhook security probes | bad signature → 401, wrong verify token → 403 (PASS) |
| Stale WhatsApp queue | 192 cancelled 2026-10-04 21:57 IST (audit-logged); 0 pending |
| WhatsApp production send (QA test) | **FAILED at Meta: (#133010) Account not registered** — token/IDs accepted; phone number +91 9175220270 must be registered for Cloud API (Altaf, §8) |

---

## 8. Remaining manual steps (Altaf only — secrets / payment)

**0. ~~URGENT — stale WhatsApp queue~~ DONE (192 cancelled). Original note: stale WhatsApp queue (decide before 09:00 IST daily cron):** CRM → Admin → Message Log shows **192 pending** queued messages created while WhatsApp was offline (customer 44, staff/team 102, OTP/security 42, other 4) — old OTP codes, repeated attendance summaries, past booking confirmations. With credentials now live, the 09:00 IST cron (or Settings → *Save & Connect*) will send them. Recommended: Message Log → **Cancel stale queue** (marks them CANCELLED, keeps the rows, audit-logged). Do **not** press *Save & Connect* in Settings before deciding (it flushes the queue).

1. ~~Generate token~~ (DONE by Altaf). **Meta → Business Settings → System users → "Sahara OS API" → Generate token**: app 1569646490957820; permissions `whatsapp_business_messaging` + `whatsapp_business_management` only; expiry **Never**. Copy it straight into Coolify (step 2). Do not paste it anywhere else.
2. **Coolify → Sahara OS → Environment**: only `WHATSAPP_WEBHOOK_VERIFY_TOKEN` is still missing (others done) — add it, then **Redeploy**. Original note: set the variables in §3 (three secrets + `WHATSAPP_PHONE_NUMBER_ID=1278812171990562`, `WHATSAPP_BUSINESS_ACCOUNT_ID=1629093895673046`, `WHATSAPP_USE_TEMPLATES=on`). Leave CAMPAIGNS / AUTO_REPLIES / AI unset. **Redeploy.**
3. **Meta App → WhatsApp → Configuration → Webhook**: Callback `https://crm.saharacleaningservices.com/api/webhooks/whatsapp`, Verify token = same value as step 2 → *Verify and save* → subscribe **messages**.
4. **Payment method**: if Meta asks, add it yourself in Business Settings → Billing / WhatsApp Manager → Payment configurations. (Not done by Claude by instruction.)
5. **Go-live test**: CRM → Marketing → WhatsApp → *Send test booking* → 9921215250 only; reply from that phone and confirm it appears in CRM → WhatsApp Inbox. Then create one test booking for that number and confirm the booking-confirmation message + View Booking link.
6. Only after 5 passes: decide on `WHATSAPP_CAMPAIGNS=on` for a festival campaign (opted-in contacts only).

---

**Registration status (2026-10-05):** WhatsApp Manager shows +91 9175220270 = **Pending** (not registered); Two-step verification = **OFF** ("Turn on"). 3 registration PIN attempts failed (2026-10-04/05) — Meta temporarily blocks PIN attempts after repeated failures. **Do not retry registration until the block clears (wait 12–24 h).** Single next action (Altaf): WhatsApp Manager → Phone numbers → +91 9175220270 → ⚙ → *Two-step verification* → **Turn on** → set a NEW 6-digit PIN (password manager only), then register the number once using that same PIN. If Meta still rejects it, use *Forgot PIN / reset* there or contact Meta Business Support; do not guess repeatedly.

**NEXT (Altaf) — register the number:** Meta for Developers → app 1569646490957820 → WhatsApp → Step 2 *Production setup* → **Register your WhatsApp phone number** (or WhatsApp Manager → Phone numbers → +91 9175220270). Choose a 6-digit two-step-verification PIN (keep it secret, store it only in your password manager); enter any SMS/voice code Meta sends. Then **Add payment** if Meta asks. Then CRM → Marketing → **QA test** (click OK) to 9921215250 and reply from that phone; confirm it appears in CRM → WhatsApp Inbox.

## 9. Maintenance

- **Deploy**: commit → `git push origin HEAD:coolify-deploy` → wait ~5 min. Roll back in Coolify by redeploying an earlier commit (DB changes are additive and stay).
- **Rotate WhatsApp token**: generate a new system-user token → replace `WHATSAPP_ACCESS_TOKEN` in Coolify → redeploy → revoke the old token in Meta.
- **Rotate App Secret / verify token**: change in Meta, then the matching Coolify variable, redeploy, re-verify webhook.
- **Template changes**: any button/body change needs Meta re-approval; update `src/lib/whatsapp-cloud-templates.ts` only after approval.
- **New staff**: Staff → add staff → *Enable Staff App login* → hand over mobile + PIN.
- **Monthly**: Reports → Export Center → download month; check Profit dashboard matches.
- **Do not**: touch +91 7083347130 / WABA 108381505270532; turn on AI/auto-replies or live campaigns without owner approval; store secrets in files or chat.

**Agency access audit (2026-10-05):**
- Google Ads 892-332-3597: only user = owner (admin). Manager link **Brand Make Digital Marketing Solution (898-956-9172)**, not owner; conversions are account-owned (no cross-account tracking); Google says the account keeps serving after unlink. Unlink was blocked at a Google **passkey "Confirm it's you"** step → owner must finish: Admin → Access and security → Managers → Remove access → Unlink → passkey.
- Meta Business 152082702561104: partner **Brand Make + Partners (980500526587392)** has full access to FB Page + Instagram, AND **owns the only ad account "Sahara Cleaning Services" (1065166308165456)**, which is shared to Sahara. Removing the partner would cut Sahara's ad access and stop ads. Nothing changed. Plan: create a Sahara-owned ad account (add payment method, connect pixel/dataset), move campaigns over, then remove Brand Make's Page/IG access and the partner.
- WhatsApp +91 9175220270: still Pending, 2FA OFF. Needs owner to set the PIN and register (see above).
