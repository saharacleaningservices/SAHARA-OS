# Sahara OS — WhatsApp Engine: Audit, Hardening Plan & Maintenance Guide

Audited 29 Oct 2026 against `coolify-deploy` @ `49d524e`. Findings F1–F4 in section 3 are **implemented** by the `fix/whatsapp-webhook-hardening` change; the snippets are kept as design notes.
Tests: `tests/whatsapp-webhook-hardening.test.ts` (8 tests) covers taps, duplicates, 500-on-DB-error, poison-message cap, signature and bad JSON.

---

## 1. Verdict

| Area | Status |
|---|---|
| Webbrand / ConnectIt decoupling | **Clean.** Zero references in `src/`, `scripts/`, `prisma/`, `Dockerfile`, `.env.example`. Only mentions are in `docs/` (ownership-recovery notes about agency access to Search Console/GTM — not WhatsApp). Outbound goes straight to `graph.facebook.com`; inbound is verified with Meta's HMAC. |
| Menu tap → CRM write | **Partial.** Text greeting creates/updates a Lead. A menu *tap* only sends a booking link; it writes nothing. Slots/Bookings are created only by the web booking form, by design. |
| Webhook error handling | **Weak spot.** Always returns 200 and swallows errors, so a transient DB error = a lost customer message with no trace. |
| Outbound retry | **Good.** 3 attempts on 429/502/503/504 and connect errors; timeouts deliberately not retried (avoids duplicates). |
| Config risk | **Check now** — see section 2. |

---

## 2. Verify in Coolify before anything else (these silently break the bot)

| Variable | Why it matters |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | The code reads **this** name. `WHATSAPP_TOKEN` is not read anywhere. If Coolify has `WHATSAPP_TOKEN`, sending is not configured (messages stay QUEUED). |
| `WHATSAPP_PHONE_NUMBER_ID` | Required together with the token. |
| `WHATSAPP_APP_SECRET` | In production, if unset, **every POST is rejected 401** (`isValidMetaSignature`). Meta App → Settings → Basic → App Secret. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Must equal the Meta dashboard value (GET handshake). |
| `WHATSAPP_AUTO_REPLIES=on` | Otherwise the menu and all auto-replies are suppressed (logged, not sent). |
| `WHATSAPP_OUTBOUND_MODE=live` | In `transactional` mode only approved *templates* reach real customers; free-text bot replies and the menu are blocked. `test` = owner numbers only. |
| `CUSTOMER_BOOKING_URL` | Default is `https://saharacleaningservices.com/booking`, which the code comments say is a 404 on the old WordPress site. Set it to `https://booking.saharacleaningservices.com/booking` until the 301 exists, or every menu link is dead. |
| `DATABASE_URL` + persistent volume | SQLite. Without a mounted volume, each redeploy wipes leads and WhatsApp logs. |
| `WHATSAPP_AI_ENABLED` | Keep unset/off unless you want the AI assistant; when on, the menu is bypassed for free text. |

Meta dashboard: webhook field **messages** subscribed on the WABA; callback `https://booking.saharacleaningservices.com/api/webhooks/whatsapp`. (The `/api/webhook` prefix is allow-listed on the booking host in `src/middleware.ts`, so this route is reachable there.)

---

## 3. Findings and fixes (priority order)

### F1 — Lost messages on transient errors (High)
`route.ts` `POST`: all work is inside one `try/catch` that logs and still returns 200; `recordInboundWhatsApp(...).catch(() => undefined)` and `applyWhatsAppStatus(...).catch(() => {})` discard errors silently. Meta never retries a 200, and the inbound dedupe row means a redelivery would be skipped anyway.

Proposed change (no schema migration needed): throw on DB failure, undo the dedupe row, log structured, return 500 so Meta redelivers with backoff.

```ts
const log = (level: "info" | "warn" | "error", evt: string, data: Record<string, unknown> = {}) =>
  console[level](JSON.stringify({ ts: new Date().toISOString(), src: "wa-webhook", evt, ...data }));

// handleInboundMessages(): return true if every message succeeded
let ok = true;
for (const m of messages) {
  if (!m.from) continue;
  const inbound = await recordInboundWhatsApp({ from: m.from, providerMessageId: m.id, body: inboundText, profileName }); // no .catch
  if (inbound === null) { log("info", "duplicate_skipped", { id: m.id }); continue; }
  try {
    await processInboundMessage({ ...m, from: m.from }, reviewUrl, profileName);
    log("info", "processed", { id: m.id, type: m.type, tap: m.interactive?.list_reply?.id });
  } catch (err) {
    ok = false;
    log("error", "inbound_failed", { id: m.id, type: m.type, err: err instanceof Error ? err.message : String(err) });
    if (inbound) await db.whatsAppMessage.delete({ where: { id: inbound.id } }).catch(() => {}); // let the redelivery run again
  }
}
return ok;

// POST(): replace the final catch/return
let allOk = true;
try {
  for (const entry of payload?.entry ?? [])
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const results = await Promise.allSettled([handleInboundMessages(value), handleStatuses(value)]);
      for (const r of results) if (r.status === "rejected" || r.value === false) allOk = false;
    }
} catch (err) { allOk = false; log("error", "payload_failed", { err: String(err) }); }
return allOk ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false }, { status: 500 });
```
Also log the three early exits (bad signature → `warn` with `x-forwarded-for`, unparseable JSON → `warn`, `statuses` with `errors[]` → `warn` with Meta error code), because today they are invisible. Lead creation is already idempotent (`intakeKey`), so redelivery cannot create duplicates; the only residual risk is a duplicate bot reply if the failure happens after the send, which is acceptable.

### F2 — Menu taps do not touch the CRM (Medium)
`bot_home` / `bot_pest` / `bot_painting` only reply with a tracked link. A customer who taps from a Click-to-WhatsApp ad without typing text gets no lead, and an auto-created lead is always `HOME_DEEP_CLEANING` even if they chose Pest Control.

Fix: before replying to a tap, reuse the existing idempotent function.
```ts
if (m.type === "interactive" && isBotRow(tapped)) {
  await handleWhatsAppInquiry(m.from, `Menu selection: ${m.interactive?.list_reply?.title ?? tapped}`, profileName, parseCtwaReferral(m.referral), { silent: true });
  // optional: if the lead is still stage NEW, set lead.service from the row (bot_pest → pest enum, bot_painting → painting enum; confirm names in prisma/schema.prisma)
  ...existing reply...
}
```
This creates the lead if none exists, or adds a timeline note on the open one — the owner then sees *what the customer chose* in the CRM.

Slots/Bookings stay in the booking form (`public-booking-core.ts`) on purpose: the link carries `utm_source=whatsapp&utm_medium=chatbot`, so Marketing → Sources credits the bot. Keep it that way; do not write bookings from chat.

### F3 — Stale doc comment (Low)
Header comment in `route.ts` still names `crm.saharacleaningservices.com`. Update to the booking host so future maintainers register the right URL.

### F4 — Missing tests (Medium)
`bot_status` and menu-tap lead capture have no webhook-level test; only `botReply` text is asserted. Add tests to `tests/whatsapp-optout.test.ts` style: (a) signed list_reply tap creates one lead, (b) same message id twice → one lead and one reply, (c) forced DB error → HTTP 500 and no inbound row left behind.

---

## 4. Route handler reference — `POST /api/webhooks/whatsapp`

**File:** `src/app/api/webhooks/whatsapp/route.ts` · **Public path** via `src/middleware.ts` (`/api/webhook` prefix) · **Runtime:** Node, `force-dynamic`.

| Step | What happens | Code |
|---|---|---|
| GET | Meta handshake: echoes `hub.challenge` if `hub.verify_token` equals `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, else 403 | `GET` |
| 1 | Reads raw body, verifies `X-Hub-Signature-256` (HMAC-SHA256, `WHATSAPP_APP_SECRET`, timing-safe). Missing secret in production = reject | `isValidMetaSignature` |
| 2 | Parses JSON; bad JSON → 200 (nothing to retry) | `POST` |
| 3 | Per change: handles `messages` and `statuses` | `handleInboundMessages`, `handleStatuses` |
| 4 | Each inbound message is logged as an INBOUND `WhatsAppMessage` (dedupe on Meta message id) and linked to the customer's latest lead | `recordInboundWhatsApp` |
| 5 | Routing in `processInboundMessage`: STOP/START → consent flip + confirmation · `MORE` → 7-option list · short greeting/price/book (`isBotTrigger`) → lead + 4-option menu · other free text → lead (or note) + optional AI · list tap `bot_*` → booking link · `bot_status` → customer's latest job · older button/list ids kept working | `processInboundMessage` |
| 6 | Statuses (sent/delivered/read/failed) stamp the outbound row | `applyWhatsAppStatus` |

**Lead logic** (`handleWhatsAppInquiry`): open lead or lead <24 h → timeline note only; active job → note on its lead/activity log; else create one `NEW` lead (`source WHATSAPP`, 15-min HIGH follow-up, team notification), idempotent via `intakeKey = WA:<mobile>:<IST day>`.

**Menu:** `src/lib/whatsapp-chatbot.ts` — `BOT_ROWS` (ids `bot_home`, `bot_pest`, `bot_painting`, `bot_status`), `botReply()` text, `BOT_TRIGGER` regex. Row titles ≤24 chars, descriptions ≤72 (Meta limits). Booking links come from `src/lib/booking-target.ts`.

**Sending:** `src/lib/whatsapp.ts` → `sendWhatsApp` / `sendWhatsAppInteractiveList` → `deliverPayload` (Graph API, 15 s timeout, retry per `src/lib/send-retry.ts`). Never throws; failures are stored on the `WhatsAppMessage` row (`FAILED` + `errorMessage`) and re-attempted by the daily `flushWhatsAppQueue`. Gates in order: auto-replies flag → opt-out → outbound mode → send.

**Credentials resolution:** `src/server/integrations.ts` — Settings → Integrations row first, then env vars.

**Debug runbook**

| Symptom | Check |
|---|---|
| No replies, nothing in log | Meta webhook not subscribed to `messages`, or `WHATSAPP_APP_SECRET` unset (401s in Coolify logs) |
| Inbound logged, no reply | `WHATSAPP_AUTO_REPLIES` not `on`, or `WHATSAPP_OUTBOUND_MODE` not `live`, or conversation set to HUMAN in WhatsApp Inbox |
| Message row `FAILED` | Read `errorMessage` in Admin → WhatsApp Log (token expired, 24 h window, number not allowed) |
| Menu links 404 | `CUSTOMER_BOOKING_URL` |
| Duplicate leads | Should be impossible (`intakeKey`); inspect `Lead.intakeKey` |

---

## 5. Final verification checklist (run from a real phone, outbound mode `live`)

1. Meta → Webhooks → "Verify and save" succeeds; `messages` field subscribed.
2. Send `Hi` → menu arrives; a `NEW` lead appears with source WhatsApp and a 15-min follow-up.
3. Tap each of the 4 rows → correct reply; links open the booking page with the service pre-selected (not 404); after F2, a timeline note/lead exists for each tap.
4. Tap **Booking / Crew Status** from a number with a job and one without.
5. Reply `STOP`, then `START` → confirmation each time; opt-out respected on the next send.
6. Resend the same payload (Meta "Test" button or `curl` with valid signature) → no second lead/reply.
7. Send an unsigned `curl` POST → 401.
8. Temporarily rename `WHATSAPP_ACCESS_TOKEN` in a staging copy → inbound still recorded, reply row `FAILED` with a clear error, webhook still 200.
9. Take the DB offline in staging (after F1) → webhook 500, then Meta redelivers and the message is processed.
10. Admin → WhatsApp Log shows INBOUND + OUTBOUND rows with delivered/read ticks.
11. Redeploy in Coolify and confirm leads from step 2 are still there (volume check).
12. Run `npm test` and `npm run build` before merging to `coolify-deploy`.
