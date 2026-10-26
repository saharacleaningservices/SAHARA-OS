# WhatsApp Cloud API & compliant marketing — readiness report (SOS-05)

Audit date 2026-10-15. Read-only checks in the owner's signed-in WhatsApp Manager and a restored copy of the 2026-10-14 production backup. No message was sent, no template/number/setting changed, no spend.

The four things are reported **separately**:

| Area | Status | Evidence |
|---|---|---|
| 1. API readiness | **READY (TEST MODE)** | WABA 1629093895673046, one number **+91 91752 20270**, display name **"Sahara Cleaning Services"**, Connected, quality High. Webhook `/api/webhooks/whatsapp`: 403 wrong verify token, 401 bad/unsigned signature; delivered/read receipts stored (`deliveredAt`/`readAt`) and now visible in the Message Log (branch `feat/message-log-delivery`). Outbound is limited to the approved test number: of 1,509 logged messages 1,488 were CANCELLED by the TEST-mode gate, 11 SENT, 10 RECEIVED. |
| 2. Template approval | **15 templates ACTIVE** (all "Quality pending" = too few sends to rate) | Utility (9): booking_request_received, booking_confirmed, booking_confirmed_v3, booking_rescheduled, booking_cancelled, advance_payment_request, payment_received, pay_after_service_reminder, service_reminder (+ hello_world). Marketing (5): festival_offer, diwali_festival_offer, customer_reactivation, review_request, test_booking. |
| 3. Consent readiness | **NOT READY for any promotion** | Backup of 2026-10-14: leads 210 active — **OPTED_IN 2**, UNKNOWN 208, opted-out 0; `WhatsAppConsent` (STOP) rows 0; the 4,231 customers have no consent field at all, so they are UNKNOWN. Eligible promotional audience today = **2 numbers**. (Earlier "1 of 4,312" counted customers+leads; the current opt-in count is 2.) |
| 4. Campaign launch | **NOT AUTHORISED** | `WHATSAPP_CAMPAIGNS` live switch is off by design; no live campaign, no bulk send. |

## Controls verified (code audit + tests)
- STOP/UNSUBSCRIBE (whole-message match; CANCEL is not an opt-out) → `WhatsAppConsent.optedOut` + lead consent; START reverses it. Opt-out checked before every send; fail-closed in broadcasts.
- Broadcast: Admin-only, Cloud API must be connected, LIVE needs `WHATSAPP_CAMPAIGNS=on`; uploads never grant consent (only recorded opt-in and no STOP); de-duplication; a campaign never re-sends to a number already SENT/QUEUED; one broadcast at a time; 50–100 msg/min pacing.
- **New (branch `feat/whatsapp-consent-guard` `38862c5`, local):** `sendWhatsAppTemplate` itself now refuses any MARKETING-category template unless the number has a recorded opt-in and no STOP (defence in depth — before, only the broadcast/customer-campaign paths filtered). Transactional (utility) templates and the approved QA number are unaffected. 8 tests pass (`npm run test:whatsapp`), ops/inquiry/eod suites and `tsc` unchanged.
- Transactional vs promotional are separated by template category and by `WHATSAPP_OUTBOUND_MODE=transactional` (marketing templates blocked for customers).

## Findings to fix / decide
1. **Code ↔ Meta template mismatch:** the code defines `sahara_booking_confirmed_v2`, `sahara_job_completed`, `sahara_customer_followup` and `sahara_review_request_v2`, which do **not** exist in WhatsApp Manager (only `sahara_review_request` exists, as Marketing). If `WHATSAPP_REVIEW_TEMPLATE=v2` (or similar v2 flags) were switched on, those sends would fail. Keep the flags off until the templates are submitted and approved (owner action in WhatsApp Manager), or point the code at approved names.
2. **Review request is a MARKETING template:** sending it needs the customer's recorded opt-in (now enforced) — the booking form's opt-in checkbox and staff's one-tap consent on the job card are the capture points; only 2 numbers have it so far.
3. **Consent capture is the bottleneck:** nothing can be promoted until opt-ins are recorded legitimately (booking-form checkbox, staff-recorded verbal consent with note, customer replying START). Do not import/purchase lists.
4. **Display name** is already "Sahara Cleaning Services" on the Cloud API number; the customer-facing "tap-to-chat" number on the site is +91 7083347130 (owner decision 2026-10-11) — a different, non-API number, so customers who message it do not reach the CRM inbox. A single number for both would need an owner decision (migrating a number to the API has consequences) — not touched.

## Pricing (verified from Meta's developer docs, per-message since 2026-07-01)
- Free-form (non-template) messages: only inside an open 24-hour customer-service window, free.
- Utility templates inside an open window: free; outside it: charged per delivered message (third-party sources ≈ ₹0.115; confirm in Meta's rate card).
- Marketing templates: always charged per delivered message (third-party sources ≈ ₹0.78–0.88 each in 2026; Meta published a higher India marketing rate from 2026-01-01). Click-to-WhatsApp ad entry points open a 72-hour free window.
- Needs a payment method on the WABA (owner-only) before LIVE messaging; none activated. Example: 500 consented marketing messages ≈ ₹400–450 at those quoted rates (estimate, not a quote).

## Controlled test plan (no cost beyond the single test message; owner present)
1. Keep `WHATSAPP_OUTBOUND_MODE` as is (test number only). From Admin → Marketing → WhatsApp Broadcast choose TEST: the audience is forced to 9800817070. Confirm: one message, status SENT → DELIVERED/READ in the Message Log.
2. Reply STOP from the test phone: expect an opt-out confirmation, a `WhatsAppConsent` row, and a second TEST send refused. Reply START: reinstated.
3. Send the same TEST campaign name twice: the second is skipped (duplicate prevention).
4. Only after ≥50 genuine opt-ins exist and the owner approves LIVE + budget: a pilot to 10–20 opted-in contacts with `WHATSAPP_CAMPAIGNS=on`, then review failures/blocks/quality before scaling. Never to the existing contact list without opt-in.

## Official Business Account (green tick) — eligibility only
Requires Cloud API (met), completed Meta Business Verification (status not visible to Claude — Business Settings pages do not render in the automation browser), and Meta's judgement of brand notability (several independent reputable news mentions; paid/self-published content does not count). Free to request per vendor sources; Meta decides; no SLA; approval cannot be promised. Owner action: tell Claude the Business Verification status (Business Settings → Security centre); if verified, request the badge from WhatsApp Manager. A complete business profile (logo, address, website, description) does not need the badge.

## Owner actions (single steps)
1. Business Verification status (see above).
2. Decide whether to submit the missing v2 templates or keep the v2 flags off (default: off).
3. Record legitimate opt-ins (booking checkbox, job-card consent tap) — this is the real launch blocker.
4. Later, only if you want live messaging: add a payment method to the WABA and approve a budget.

## Phase 2 (22 Oct 2026): booking confirmation with all three actions in ONE message
What the customer gets when a booking is confirmed (one message per booking; repeat or simultaneous confirmations never send twice):

| Mode | Message | Actions |
|---|---|---|
| Default (templates off) | Plain text | Booking link, Quotation link, Pay advance link, Google review link (all in the text) |
| `WHATSAPP_USE_TEMPLATES=on` + `WHATSAPP_BOOKING_TEMPLATE=v4` | Approved template `sahara_booking_confirmed_v4` | Buttons: **View Quotation**, **Pay Now / Later** (Meta allows max 2 link buttons) + the Google review link in the message text (from Settings → Social Proof → Google Review Link) |
| `...=v3` (today's approved template) | `sahara_booking_confirmed_v3` | Same two buttons + a "Google Review" quick reply, which only answers while auto-replies are ON |

Owner steps to switch to v4 (nothing changes until then):
1. WhatsApp Manager → Message templates → Create: name `sahara_booking_confirmed_v4`, category **Utility**, language **English**, body and two URL buttons exactly as in `src/lib/whatsapp-cloud-templates.ts` (key 2d). Submit and wait for **Active**.
2. Coolify → Environment: `WHATSAPP_USE_TEMPLATES=on` and `WHATSAPP_BOOKING_TEMPLATE=v4`. Redeploy.
3. Leave `WHATSAPP_OUTBOUND_MODE` as it is: in TEST mode only the QA number receives it. Customers receive it only after you choose `transactional` (utility templates only) or `live`.
4. Confirm one test booking for the QA number and check the message, both buttons and the review link.

Note: Meta may re-classify a template that mentions reviews as Marketing. If that happens, keep v3 (or the plain text) and send the review request after the job is completed (that flow already exists).
