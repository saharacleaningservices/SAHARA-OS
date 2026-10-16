# Google Ads — negative keywords, East Pune lead-attribution map, access check

Prepared 2026-10-16. Read-only planning document: nothing here has been applied to the
Google Ads account (988-668-0860). Any change in Google Ads, and any budget, needs the
owner's approval (see `docs/OWNERSHIP_RECOVERY_PLAN.md` §4 and SOS-14).

Grounded in the 2026-10-05 read-only audit recorded in `docs/OWNERSHIP_RECOVERY_PLAN.md`:
"cleaning services near me" ≈ 48% of spend; competitor and low-value small-job terms;
location setting "presence or interest" put ~58% of spend outside the 8 km radius;
ad text "Lowest Cost Guaranteed" is unsubstantiated.

---

## 1. Brand Make access — already removed; keep it removed

SOS-07 is **VERIFIED COMPLETE (2026-10-15)**: Managers list empty, 0 pending approvals,
Sahara is the only user/admin, billing (Sahara's own card) and conversion goals unchanged.

Monthly check (owner, 2 minutes, read-only):
1. Google Ads → Admin → **Access and security** → **Users**: only contact@saharacleaningservices.com (Admin).
2. Same page → **Managers**: empty. Any new manager request → do not accept unless the owner invited it.
3. Admin → **Billing** → payment method is Sahara's own; no unknown payments profile.
4. Goals → **Conversions**: the same goals as before (Submit lead form, Phone call lead, …).
5. Security: keep a working sign-in method on the owner's devices (passkey or "Try another way"), so a
   future access change never depends on an agency.

---

## 2. Negative keyword list

Add as a **shared negative keyword list** ("Sahara — standard negatives") and apply it to every
Search campaign. Match types: phrase match `"…"` unless shown as exact `[…]`.

### 2a. Jobs, careers, training (no customer intent)
`"job"` · `"jobs"` · `"vacancy"` · `"vacancies"` · `"hiring"` · `"recruitment"` · `"salary"` ·
`"career"` · `"careers"` · `"work from home"` · `"part time"` · `"apply"` · `"resume"` ·
`"housekeeping job"` · `"cleaner job"` · `"maid job"` · `"course"` · `"training"` ·
`"certificate"` · `"certification"` · `"institute"`

### 2b. DIY / information only
`"how to"` · `"diy"` · `"tips"` · `"homemade"` · `"home remedy"` · `"youtube"` · `"video"` ·
`"pdf"` · `"checklist"` · `"meaning"` · `"definition"` · `"essay"` · `"wiki"`

### 2c. Buying products, not a service
`"vacuum cleaner price"` · `"machine"` · `"machine price"` · `"buy"` · `"amazon"` ·
`"flipkart"` · `"liquid"` · `"chemical price"` · `"spray price"` · `"cockroach gel"` ·
`"hit spray"` · `"paint price"` · `"asian paints price"` · `"paint shop"` · `"wholesale"` ·
`"dealer"` · `"distributor"` · `"franchise"`

### 2d. Free / bargain hunting
`"free"` · `"free service"` · `"cheapest"` · `"lowest price"`
(also remove "Lowest Cost Guaranteed" from ad text — it is unsubstantiated.)

### 2e. Competitor brand searches (recorded as low-value in the audit)
`"urban company"` · `"urbanclap"` · `"urban clap"` · `"housejoy"` · `"bro4u"` · `"justdial"` ·
`"sulekha"` · `"nobroker"`
Review the Search terms report monthly and add any new competitor names that appear.

### 2f. Outside the service area (other cities)
`"mumbai"` · `"thane"` · `"navi mumbai"` · `"nashik"` · `"nagpur"` · `"aurangabad"` · `"kolhapur"` ·
`"satara"` · `"bangalore"` · `"bengaluru"` · `"hyderabad"` · `"delhi"` · `"goa"`
(Do **not** add PCMC areas — the booking site serves Pune & PCMC. For an East-Pune-only campaign, use
location targeting (§3), not negatives, to keep west-side areas out.)

### 2g. Services Sahara does not offer — owner to confirm each line before adding
`"car cleaning"` · `"car wash"` · `"laundry"` · `"dry clean"` · `"ironing"` · `"cook"` · `"nanny"` ·
`"baby sitter"` · `"pest control for rats only"` · `"septic tank"` · `"drainage"` · `"plumber"` ·
`"electrician"` · `"carpenter"`
(If any of these *is* offered — e.g. water-tank or chimney cleaning — leave it out.)

### 2h. Small single jobs — OPTIONAL, owner decision
Owner rule (2026-10-10): **no minimum booking value** — small jobs are bookable at pricing-master
prices. But paid clicks should go to the priority work (full-home cleaning, interior painting, pest
control, high-value commercial). If the owner wants Ads to target only priority work, add:
`"single room"` · `"one room"` · `"bathroom only"` · `"only kitchen"` · `"fan cleaning"` ·
`"window cleaning only"`
Otherwise skip §2h and let the landing page sell the full-home packages.

### 2i. "near me" — do NOT add as a negative
"cleaning services near me" was ~48% of spend. It is a real customer search; the waste came from
the **location setting**, not the keyword. Fix with §3 (Presence) and keep the keyword.

---

## 3. Location targeting (fixes the ~58% out-of-area spend)

Campaign → Settings → Locations → **Location options → Target: "Presence: people in or regularly in
your targeted locations"** (not "Presence or interest").

Target zones for an East Pune campaign (add as radius pins or named localities):

| Zone | Localities |
|---|---|
| Z1 Core (business base, PIN 411060) | Undri, NIBM, Mohammed Wadi, Kondhwa, Wanowrie, Fatima Nagar |
| Z2 Hadapsar belt | Hadapsar, Magarpatta, Amanora, Manjri, Mundhwa, Keshav Nagar |
| Z3 Kharadi / Viman Nagar | Kharadi, Viman Nagar, Wadgaon Sheri, Kalyani Nagar, Yerawada |
| Z4 North-east growth | Wagholi, Lohegaon, Dhanori, Chandan Nagar |
| Z5 Inner east | Koregaon Park, Camp, Salunke Vihar, Wanowrie |

Bid adjustments only after 2–3 weeks of data (compare CRM-qualified leads per zone, §4).

---

## 4. Lead-attribution map (how each East Pune lead is traced in Sahara OS)

What already exists in Sahara OS (verified 2026-10-15, `docs/OWNERSHIP_RECOVERY_PLAN.md` §9):
the landing form stores `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`, `gclid`,
`landingPage`, `acquisitionChannel` and the customer's `area` on every lead (Lead schema verified).

### 4a. Final URL + tracking template (per ad group)
Final URLs (the four existing ad landing pages, `noindex`, lead form + Call/WhatsApp):
`https://booking.saharacleaningservices.com/landing/home-deep-cleaning-pune` ·
`…/landing/interior-painting-pune` · `…/landing/pest-control-services-pune` ·
`…/landing/office-commercial-cleaning-pune`
Tracking template (account level):
`{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={_campaign}&utm_term={keyword}&utm_content={_zone}`
Custom parameters: `{_campaign}` = campaign slug (e.g. `east_pune_home_deep_cleaning`),
`{_zone}` = `z1`…`z5` set at ad-group level (one ad group per zone if bidding by zone).

### 4b. Map: source → CRM fields → report

| Touchpoint | Captured as | CRM field(s) | Where to read it |
|---|---|---|---|
| Google Ads click (search) | gclid + UTMs | `gclid`, `utmSource=google`, `utmMedium=cpc`, `utmCampaign`, `utmTerm` | Profit → Marketing (filter by campaign) |
| Zone of the ad group | `utm_content=z1…z5` | `utmContent` | Marketing report by campaign |
| Customer's actual locality | form "Area" field | `area` | Leads list → filter by area |
| Phone call from the ad | Ads call extension | Google Ads "Phone call lead" (not in CRM) | Google Ads only — log the call as a lead in CRM with source "Google Ads" |
| WhatsApp click from landing page | `whatsapp_click` event | lead created by staff with source "Google Ads" | GA4 + CRM |
| Lead → booked job | lead stage → job | `stage`, linked job, job value | CRM pipeline |

### 4c. Monthly decision table (fill from CRM, not from Google's "conversions")

| Zone | Leads | Qualified | Booked jobs | Revenue | Ad cost | Cost per booked job |
|---|---|---|---|---|---|---|
| Z1 … Z5 | | | | | | |

Rule: keep / raise budget only for zones whose **cost per booked job** is below the owner's target;
use Google's "conversions" only as an early signal (1,590 of 1,908 recorded conversions were
"phone call leads", only 419 real calls).

### 4d. Gaps to close before spending (from SOS-14 / recovery plan — owner approval)
1. Set `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL` in Coolify
   (nothing loads on production today) — production change.
2. Fix "Phone call lead — needs attention" in Google Ads; keep one primary conversion (form submit).
3. Switch final URLs from `promo.` to `booking.…/landing/*` only after a tagged test lead is verified.
