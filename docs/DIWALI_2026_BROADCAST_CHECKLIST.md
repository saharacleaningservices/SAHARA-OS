# Diwali 2026 WhatsApp broadcast — execution & audience checklist (draft, 2026-10-17)

Owner-gated: nothing below runs until the owner approves LIVE. Template names in code: `sahara_festival_offer`, `sahara_diwali_festival_offer`
(`src/lib/whatsapp-cloud-templates.ts`). Both are MARKETING category.

## A. Before any send
- [ ] Template status is APPROVED in Meta (WhatsApp Manager) — owner checks.
- [ ] Offer price/validity matches the pricing master (owner approval; no hard-coded promo price).
- [ ] Sending number = the API number only; old WhatsApp Business number/WABA untouched; protected numbers never targeted.
- [ ] Mode is TEST; only +91 9800817070 is in `WHATSAPP_TEST_MODE_NUMBERS` (verified on production branch).

## B. Test send (owner, CRM → Marketing)
1. Pick the Diwali/festival template, audience = test number only.
2. Check: message arrives, offer text/price correct, "Stop promotions" button present.
3. Reply "Stop promotions" → contact must be marked opted-out and excluded next time.
4. Save screenshot + CRM delivery status (sent / delivered / read) and paste in the task thread.

## C. Audience segmentation (opt-in only)
Include only contacts with a recorded opt-in: website booking form consent checkbox, job-card consent, or an inbound customer chat.
| Segment | Rule | Message angle |
|---|---|---|
| A. Past customers, last 12 months | opt-in recorded, no "Stop promotions" | Diwali deep clean slots |
| B. AMC / housekeeping clients | opt-in recorded | Festival deep-clean add-on |
| C. Open leads, last 90 days | opt-in recorded | Book before the festival rush |
| D. Painting / pest enquiries | opt-in recorded | Inspection offer |
Exclude: no recorded consent, opted-out, protected numbers, invalid numbers, duplicates, anyone messaged in the last 7 days.

## D. Go-live
- [ ] Owner approves LIVE and the audience count in writing.
- [ ] Start with a small batch (≈50), wait 24 h, check quality rating and block/"stop" rate.
- [ ] Scale only if quality stays green; pause on any quality drop.
- [ ] Reply handling: staff monitor inbound replies; AI auto-replies stay OFF.
- [ ] Log results (sent/delivered/read/replied/opt-out/bookings) in the CRM and the task register.
