# WhatsApp promotional messaging — Diwali 2026 campaign pack (DRAFT, nothing sent)

Prepared 2026-10-17 on `coolify-deploy-current` (WhatsApp launch bundle merged + QA number 9800817070).
Nothing here is live. Every send below is owner-gated. No secrets in this file.

## 1. Gates before any send (in order)

| # | Gate | Owner of the step | Status |
|---|---|---|---|
| 1 | QA test number **9800817070** is a phone the owner holds, not linked to a real customer lead | Owner | Code updated on this branch; confirm the phone |
| 2 | This branch reviewed + deployed (needs owner approval to push `coolify-deploy`) | Owner | Not deployed |
| 3 | TEST send from CRM to 9800817070 → SENT → DELIVERED/READ in Message Log; image + button open on the phone; "Stop promotions" sets OPTED_OUT; START re-subscribes | Owner (CRM login) | Not done |
| 4 | Recorded marketing opt-ins exist (last known: **2** eligible). Consent is never assumed | Staff / landing forms | Landing opt-in ships with this branch |
| 5 | Owner approves recipient list + copy in chat | Owner | Pending |
| 6 | `WHATSAPP_CAMPAIGNS=on` in Coolify, first batch small, switch off afterwards | Owner | Off |

The code enforces gates 3–4 on its own: TEST mode only reaches 9800817070, and any MARKETING template to a number
without a recorded opt-in is refused and logged CANCELLED (`src/lib/whatsapp.ts`, consent guard).

## 2. Which template to use

Both are already Active in WhatsApp Manager and in the CRM broadcast list — no new Meta approval needed.

| | `sahara_festival_offer` (recommended) | `sahara_diwali_festival_offer` |
|---|---|---|
| Body | "Hi {{1}}, get ready for Diwali with Sahara Cleaning Services! We offer Home Deep Cleaning, Office & Commercial Cleaning, Interior Painting and Pest Control across Pune & PCMC. Home deep cleaning starts from ₹{{3}} (1 BHK Premium) with transparent package prices. Book early to get your preferred slot." | Image header + "Hi {{1}}, Diwali is around the corner! 🪔 … with Sahara's **Special Festival Offers**. ✨ 100% In-House Verified Staff ✨ Transparent Pricing & Pay After Service" |
| Price | `{{3}}` is filled automatically: lowest festival Premium price of the Diwali window from the pricing master (₹4,999 at the 9 Oct prices) | none |
| Buttons | Book Now → `/offers?…utm_campaign=<name>` · Stop promotions | Book Festival Clean → `/offers?…` · Stop promotions |
| Risk | none found | **"Special Festival Offers"** — festival prices are at or above regular prices (9 Oct review: say "festival packages", never "offer"/"save"). Owner decision needed before using it |

Priority services (business rules) are named in the recommended body: full-home cleaning, painting, pest control,
commercial.

## 3. Campaign plan

Diwali 2026 ≈ **8 Nov** (verify). Festival price window in the pricing master was 26 Oct – 10 Nov on 9 Oct —
confirm in CRM → Pricing master before scheduling (prices apply only to service dates inside the window).

| Wave | Date (suggested) | Template | Audience | Campaign name (`utm_campaign`) |
|---|---|---|---|---|
| 0 — QA | as soon as deployed | festival_offer, TEST | 9800817070 only | `sahara_diwali_2026_test` |
| 1 — Early booking | Sat 24 Oct | festival_offer (festival = Diwali) | all recorded opt-ins | `sahara_diwali_2026` |
| 2 — Past customers | Wed 28 Oct | `sahara_customer_reactivation` | opted-in past customers not booked in wave 1 | `sahara_reactivation_diwali_2026` |
| 3 — Last slots | Mon 2 Nov | festival_offer | opted-in, did not open/book (CRM excludes repeats per campaign name, so use a new name) | `sahara_diwali_2026_lastcall` |

Send 10:00–12:00 or 18:00–20:00 IST. Max 300 per click (code limit). Turn `WHATSAPP_CAMPAIGNS` off after each wave.

## 4. Copy for replies inside the 24-hour window (free text, sent by staff — not broadcast)

- **Price question:** "Thank you for asking! Diwali home deep-cleaning packages: Premium 1 BHK ₹4,999 · 2 BHK ₹5,499 ·
  3 BHK ₹6,999; Platinum 1 BHK ₹6,499 · 2 BHK ₹6,999 · 3 BHK ₹8,499 (service dates in the festival window). Larger
  homes are priced after a site visit. You can pick your date here: <booking link>"
  *(prices = owner's 9 Oct festival list — re-check the pricing master on the send day)*
- **Slot question:** "Slots depend on team availability — the booking page shows the live dates. Shall I hold one for
  you?"
- **Not interested:** "No problem — reply STOP anytime and we won't send promotions."

No "discount", "save", "best", "lowest" or "guaranteed". No promo price is hard-coded in the CRM.

## 5. After each wave — what to check
Message Log: SENT / DELIVERED / READ / FAILED; Marketing table: replies and bookings by `utm_campaign`;
opt-outs (stop promotions) — a spike means pause the next wave.

## 6. Next templates (not yet submitted)
Pest control, painting and facility-management templates are drafted in
`docs/WHATSAPP_SERVICE_CAMPAIGN_TEMPLATES.md` (branch `feat/backup-alerts`). Owner submits in WhatsApp Manager;
they are added to the code only after Meta shows them Active.
