# WhatsApp service-campaign templates — ready to submit (2026-10-16)

Three new **MARKETING** templates for Pest Control, Painting and Facility Management. They are **not** added to the
code yet: Sahara OS cannot create templates in Meta (the CRM only lists approved ones), and listing unapproved
templates in the broadcast panel would offer sends that fail. Workflow:
1. Owner submits each template in WhatsApp Manager (Message templates → Create → Marketing → Custom).
2. After Meta shows **Active**, Claude adds it to `src/lib/whatsapp-cloud-templates.ts` (category MARKETING → the
   consent guard automatically restricts it to recorded opt-ins) with a test.
3. Sending stays consent-only; LIVE stays off until the owner approves (see `docs/META_BUSINESS_GREEN_TICK_SETUP.md` Part D).

Rules applied to all three (Meta + owner rules): image header; `{{1}}` = customer first name (fallback "there");
one URL button to the booking site with UTM tags; **"Stop promotions"** quick-reply (handled by the webhook — tested);
no prices (they change and need owner approval); no unverifiable claims ("best", "lowest", "guaranteed"); sender is the
API number's display name "Sahara Cleaning Services". Header images: use the existing hero photos
(`public/marketing/hero-pest.webp`, `hero-painting.webp`, `hero-commercial.webp`) exported as JPG/PNG.

---

## 1. `sahara_pest_control_offer` — Marketing, English
- **Header:** IMAGE (pest control team photo)
- **Body:**
  `Hi {{1}}, is your home ready for the season? 🐜 Sahara Cleaning Services offers cockroach, termite, bed bug and ant treatment across Pune & PCMC — trained in-house staff, transparent pricing, and pay after service. Book a visit in under a minute.`
- **Footer:** `Sahara Cleaning Services · Serving Pune since 2012`
- **Button 1 (URL, dynamic):** "Book Pest Control" → `https://booking.saharacleaningservices.com/{{1}}`
  example `pest-control-pune?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=sahara_pest_control_2026`
- **Button 2 (Quick reply):** "Stop promotions"

## 2. `sahara_painting_offer` — Marketing, English
- **Header:** IMAGE (freshly painted room)
- **Body:**
  `Hi {{1}}, planning to repaint? 🎨 Sahara Cleaning Services does interior and texture painting in Pune & PCMC with a free site inspection and a written quote before work starts. Trained in-house team, clean finish, furniture covered.`
- **Footer:** `Sahara Cleaning Services · Serving Pune since 2012`
- **Button 1 (URL):** "Book Free Inspection" → `https://booking.saharacleaningservices.com/{{1}}`
  example `interior-painting-pune?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=sahara_painting_2026`
- **Button 2 (Quick reply):** "Stop promotions"
- Check before submitting: "furniture covered" only if this is the standard practice.

## 3. `sahara_facility_management_offer` — Marketing, English (B2B)
- **Header:** IMAGE (uniformed housekeeping team at an office)
- **Body:**
  `Hi {{1}}, need reliable housekeeping for your office, society or commercial complex? 🏢 Sahara Cleaning Services provides trained housekeeping staff and facility management on monthly AMC across Pune & PCMC, with a site visit and a written scope before you decide.`
- **Footer:** `Sahara Cleaning Services · Serving Pune since 2012`
- **Button 1 (URL):** "Request a Proposal" → `https://booking.saharacleaningservices.com/{{1}}`
  example `housekeeping-services?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=sahara_facility_2026`
- **Button 2 (Quick reply):** "Stop promotions"
- B2B note: send only to business contacts who opted in (e.g. via the facility-management form); never cold lists.

## After approval — checks Claude will run
- Template exists in Meta (CRM → Settings → WhatsApp templates list), category MARKETING, status Active.
- Consent guard refuses it for a number without opt-in (unit test), TEST mode sends only to the approved QA number.
- One TEST send to the QA number (after the owner's test-number change is live) → banner, name, button link with UTM,
  "Stop promotions" marks the lead OPTED_OUT.
