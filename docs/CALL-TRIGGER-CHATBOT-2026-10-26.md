# Call auto-responder, WhatsApp chatbot, review redirector — go-live checklist (2026-10-26)

## 1. Booking target
All auto-replies, chatbot links, call templates and the schema `ReserveAction` use `https://saharacleaningservices.com/booking`
(`src/lib/booking-target.ts`).

**Before deploying:** `saharacleaningservices.com/booking` is a 404 on the WordPress site today. Do one of these:
- WordPress (Redirection plugin or `.htaccess`): `301 /booking → https://booking.saharacleaningservices.com/booking` (keep the query string), or
- Coolify env `CUSTOMER_BOOKING_URL=https://booking.saharacleaningservices.com/booking` until the redirect is live.

## 2. Call trigger — `POST /api/v1/webhooks/call-trigger`
| Env (Coolify) | Value |
|---|---|
| `CALL_TRIGGER_TOKEN` | long random secret. The IVR sends `Authorization: Bearer <token>` or `?token=` |
| `CALL_AUTOREPLY` | `on` to send. Any other value = dry run (logs the lead and returns the message preview) |
| `FESTIVAL_FULL_UNTIL` | `YYYY-MM-DD`. The festival notice runs up to and including this date (IST), then switches off by itself |
| `CALL_TRIGGER_SMS` | `always` (default: WhatsApp + SMS together) · `fallback` (SMS only if WhatsApp fails) · `off` |
| `DLT_TEMPLATE_FESTIVAL_FULL`, `DLT_TEMPLATE_MISSED_CALL`, `DLT_ENTITY_ID` | DLT ids for the two SMS texts in `src/lib/call-autoresponder.ts` (register the texts word for word) |

IVR webhook URL: `https://crm.saharacleaningservices.com/api/v1/webhooks/call-trigger`. It accepts Exotel, MyOperator,
Knowlarity and Twilio-style field names (`CallFrom`/`caller`/`from`, `Status`/`CallStatus`, `DialCallDuration`/`duration`).

Rules: one auto-reply per caller per 12 h. Owner and internal numbers are never messaged. Landlines get no message.
Missed calls create or match a lead with a 15-minute call-back follow-up. Answered calls only get the festival notice.
WhatsApp TEST MODE still applies.

## 3. Meta templates to submit (WhatsApp Manager → +91 91752 20270)
`festival_booking_full_notice` and `missed_call_auto_responder`, both UTILITY. The exact body, footer, buttons and examples are in
`src/lib/whatsapp-cloud-templates.ts` (keys `call1`, `call2`).

## 4. WhatsApp chatbot
These messages now get the interactive menu: "Hi", "price", "book", "slots" and other short greetings. A new enquiry also gets it, as its acknowledgement.
Menu items: Home Deep Cleaning · Sofa/Carpet · Commercial · Slot Availability. Each tap replies with a booking link tagged
`utm_source=whatsapp&utm_medium=chatbot`. It needs `WHATSAPP_AUTO_REPLIES=on`. It stays silent under human takeover and when `WHATSAPP_AI_ENABLED=on`.

## 5. Review redirector (`/review`)
The customer taps a star rating first. 4–5★ goes to the Google keyword-chip flow. 1–3★ goes to a private feedback box: the feedback is saved as a Review row and
the team gets an alert. A "Post a public Google review instead" link stays visible, because Google forbids review gating.

## 6. Sahara OS Helper app (Android) — call log + recordings (2026-10-26)
The Android app in `android/` sends each phone's finished calls to `/api/v1/webhooks/call-trigger` and, if switched on, call audio to
`/api/v1/webhooks/call-recording` (same `CALL_TRIGGER_TOKEN`). Install steps: `android/README.md`.

| Env (Coolify) | Meaning |
|---|---|
| `CALL_TRIGGER_TOKEN` | the token each phone's app uses (one shared secret) |
| `CALL_RECORDING_UPLOADS_UNTIL` | optional `YYYY-MM-DD` (IST): the server refuses audio after this date, whatever the apps say. The app also switches itself off 30 days after the toggle is turned on |
| `FESTIVAL_FULL_UNTIL=2026-11-03` | festive notice "slots full until 3 Nov, bookings from 4 Nov" for every caller (answered **and** missed) until that date |
| `CALL_AUTOREPLY=on` | actually send (anything else = dry run) |

Rules: history (calls older than ~30 min on arrival) and outgoing calls are noted on an existing lead only — no new lead, no WhatsApp message.
A recording is stored only if the caller already has a lead, never for owner/internal numbers, and plays for office roles only.
The festive template `festival_booking_full_notice` now carries the direct booking link `https://booking.saharacleaningservices.com/booking`,
Google 4.9★, the website and Instagram — **if it was already submitted to Meta, delete it there and submit it again with this text**.
The WhatsApp sender is the Cloud API number registered in WhatsApp Manager (`+91 91752 20270` in this project), not the voice number 7083347130.
