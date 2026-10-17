# Meta Business Verification + WhatsApp green tick — documents checklist (17 Oct 2026)

Companion to `docs/META_BUSINESS_GREEN_TICK_SETUP.md` (steps). This file lists **what to prepare** and the **current status**.
Claude cannot upload documents or enter IDs; the owner does. Nothing here is a promise of approval — Meta decides.
No document contents, ID numbers or secrets belong in this repository.

## 1. Current state (read-only check of Meta Business Suite, 17 Oct 2026)
| Item | State |
|---|---|
| Business portfolio | "Sahara Cleaning Services", ID 152082702561104, created 6 Sep 2019 by Altaf Shaikh |
| **Business verification** | **Unverified** ("Meta has not verified the details of this business") |
| Legal business name in Meta | Sahara Cleaning Services |
| Address in Meta | Opposite of South gate Magarpatta City, Hadapsar Pune, Kharadi road, Pune, Maharashtra 411028, India |
| Business phone in Meta | the native WhatsApp Business app line |
| Website in Meta | https://www.saharacleaningservices.com/ |
| Primary page / primary location | None set |
| Dataset (Pixel) | "Sahara Cleaning Services", ID 2014299429231265 (created 17 Oct 2026; no events received yet) |
| Security Center | Action needed: no trusted domains; 1 user without a passkey; 1 user with a public e-mail domain |
| Domain verification | Owner reported done via DNS TXT — not re-checked here (Brand safety → Domains) |
| WhatsApp API number (+91 91752 20270) | Connected, quality High (WhatsApp Manager, 17 Oct). Display-name approval, two-step verification and registration date: **not checked — owner to confirm** |

## 2. Documents to prepare for Business Verification (owner)
Meta asks for official documents that show the **legal name and address** of the business. Which types it accepts for India
is shown inside the verification flow and can change — choose from what the flow offers. Typical set for Sahara:

| # | Document | Why | Must show |
|---|---|---|---|
| 1 | **GST registration certificate** (usual first choice) | proves legal name + address | exact legal name, address, GSTIN |
| 2 | Udyam (MSME) registration or Shop & Establishment certificate | second proof of the same name/address | name, address |
| 3 | Utility bill or bank statement for the business address (recent, < 3 months) | proves the address if Meta asks | business name + address |
| 4 | Business PAN / proprietor details, if the business is a proprietorship | only if the flow asks for it | name as on PAN |
| 5 | Ability to receive a code on the business phone **or** a business e-mail on the website domain | Meta's confirmation step | access to that phone / mailbox |

Scan tips: colour, all four edges visible, text readable, not cropped, PDF or JPG under the size the flow allows.
Do not upload documents that belong to a different name (e.g. a personal Aadhaar for the business) unless the flow asks for them.

## 3. Consistency check — fix BEFORE submitting (a mismatch is the most common reason for rejection)
Pick ONE canonical form, exactly as on the GST certificate, and make Meta, the website, Google Business Profile and the booking site agree.

| Field | Meta today | Booking site / schema | Google Business Profile | Action |
|---|---|---|---|---|
| Legal name | Sahara Cleaning Services | Sahara Cleaning Services | "Sahara Cleaning Services" and "Sahara Cleaning Services in Pune" (two verified profiles) | Use the GST name; owner decides which GBP profile is primary |
| Address | Opposite of South gate Magarpatta City, Hadapsar Pune, Kharadi road, 411028 | Opposite South Gate, Magarpatta City, Hadapsar, Pune 411028 | 411028 and a second profile with 411060 | Write the GST address in all places in the same words |
| Phone | native line (7083347130 family) | 70833 47130 / 89565 67130 | profile-specific | Use one number that can receive the Meta confirmation |
| Website | www.saharacleaningservices.com | booking.saharacleaningservices.com | varies | Meta must be able to open the site and see the same name/address/phone (the main site currently shows no address block — ask WebBrand, see `WEBBRAND_WEBSITE_SEO_SSL_AUDIT.md`) |

## 4. Meta-side steps before verification (owner, ~15 min)
1. Business Suite → Settings → Security Center → add the trusted domain `saharacleaningservices.com`; set a passkey for the remaining user; replace the public-e-mail user with a business address.
2. Settings → Business info → Edit: legal name, address and phone exactly as on the GST certificate; set the primary Page.
3. Settings → Business info → Business verification → Start. Upload the document(s) from section 2. Wait for the decision (days to weeks).
4. Do not re-submit repeatedly; a rejection reason is shown in the same place.

## 5. WhatsApp green tick (Official Business Account) — what is needed and where Sahara stands
Applies only to the Cloud API number +91 91752 20270 (not the native app line).
| Requirement (Meta developer docs) | Status |
|---|---|
| Business portfolio verified | **No — blocked until section 2–4 are done** |
| Number registered on the platform ≥ 30 days | Unknown — owner to check the registration date in WhatsApp Manager |
| Display name approved | Unknown — WhatsApp Manager → Phone numbers → status |
| Two-step verification on | Unknown — owner to confirm |
| Policy compliance, no quality warnings | Quality shows High; keep promotions consent-only |
| Notability evidence | Collect 3–5 independent, unpaid mentions (news, directories). Sahara has none collected yet |

Realistic order: Business Verification → confirm display name/2-step → collect mentions → request the badge. If Meta declines, it allows a new
request after about 30 days. Never buy "green tick" services; they are not Meta-approved.

## 6. Collect now (no cost)
- [ ] GST certificate PDF and one second proof (Udyam / shop act)
- [ ] The exact legal name and address string from the GST certificate (copy into a note, not into the repo)
- [ ] A phone/e-mail that can receive Meta's code
- [ ] 3–5 links to independent mentions of Sahara (news, Justdial/Sulekha-style directories, Google reviews page)
- [ ] Square logo 640×640 for the WhatsApp profile
