# Meta — owned Ads account, Business Verification, green tick, and compliant WhatsApp opt-in

Prepared 2026-10-16. Owner-only steps: they need the owner's Meta login, ID documents and payment decisions.
Claude changed nothing in Meta. Facts about Sahara's accounts come from the read-only audit of 2026-10-15
(`docs/MASTER_TASK_REGISTER.md` SOS-08); rules come from Meta's official pages (sources at the end).

## Current state (2026-10-15 audit)
| Item | State |
|---|---|
| Business portfolio | "Sahara Cleaning Services" (ID 152082702561104), created 2019 by Altaf Shaikh |
| Business Verification | **Not verified** |
| Ad accounts in the portfolio | **None.** The old campaigns live in ad account `343079872519451`, which sits **outside** the portfolio |
| Old campaigns | 3 campaigns switched **On** with "Payment error" — adding funds would let them spend at once |
| People with full access | 2: Altaf Shaikh, and a profile "Sahara Cleaning Services @saharacleaningservices.pune" (owner to confirm it is his) |
| Security Center | 1 user without a passkey; no trusted domain |
| WhatsApp | Cloud API number +91 91752 20270 (WABA with Visa ····2994 on file); the native app line +91 70833 47130 stays on the WhatsApp Business **app** |

---

## Part A — Put a Sahara-owned ad account under the business portfolio
Goal: every ad account, pixel and page sits inside Sahara's portfolio, so no agency or personal profile can hold them.

1. **Stop accidental spend first:** Ads Manager → ad account 343079872519451 → switch the 3 old campaigns **Off**
   (they are On with a payment error). Do this before adding any payment method.
2. **Find out who owns 343079872519451:** Ads Manager → ⚙ Ad account settings → "Ad account owner".
   - If it is **Altaf's own profile** → go to step 3 (claim).
   - If it is **an agency / another person** → do not claim; ask them to **share** it as a partner, or start fresh (step 4).
3. **Claim (owner's own account only):** Meta Business Suite → ⚙ Settings → **Accounts → Ad accounts → Add →
   Add an ad account** → enter `343079872519451`. Claiming moves ownership into the portfolio and is effectively
   permanent; only claim an account you own.
4. **Or create a new owned account:** Settings → Accounts → Ad accounts → Add → **Create a new ad account** → name
   "Sahara Cleaning Services — Ads", time zone **Asia/Kolkata**, currency **INR** (cannot be changed later).
5. Assign people: give Altaf **full control**; add others only with the role they need.
6. Payment method: add it **only when a campaign is approved to run** (owner decision, budget agreed).
7. Pixel / dataset: Settings → Data sources → Datasets → create one owned by the portfolio; its ID goes into
   Coolify as `NEXT_PUBLIC_META_PIXEL_ID` (build-time; Sahara OS already fires Lead/booking events when set).
8. Security: add a passkey for the remaining user; add `saharacleaningservices.com` under Brand safety → Domains
   (needs a DNS TXT record in Namecheap — owner).

## Part B — Business Verification (needed for the green tick, higher WhatsApp limits and some ad features)
1. Meta Business Suite → ⚙ Settings → **Business info** (or Security Center) → **Start verification**.
2. Legal name exactly as on your GST / Udyam / shop-act document: "Sahara Cleaning Services".
3. Address, phone and website must match the document and the website (https://www.saharacleaningservices.com).
4. Upload one official document (GST certificate is the usual choice) and confirm via e-mail at
   @saharacleaningservices.com (works once the Workspace payment is fixed) or via phone.
5. Wait for Meta's decision (days to a few weeks). Status appears in Security Center.

## Part C — Green tick (WhatsApp Official Business Account)
Applies **only** to the Cloud API number +91 91752 20270. A number in the WhatsApp Business **app** (the native line
+91 70833 47130) is **not eligible** — this matches the owner rule to keep that line native.

Meta's current eligibility (developer docs):
- the business follows the WhatsApp Business Messaging Policy;
- the phone number has been registered on the platform for **at least 30 days**;
- the business portfolio that owns the number is **verified** (Part B);
- **two-step verification** is enabled on the number;
- the number's **display name is approved**.
Meta also judges notability (an older help article asks for coverage in well-known publications; paid or
self-published articles do not count). Approval is Meta's decision and cannot be promised.

Steps (after Part B is approved):
1. WhatsApp Manager → Phone numbers → +91 91752 20270 → confirm display name **Approved** and **two-step verification On**.
2. Same number → Settings → **Request Official Business Account** (or "Submit request" under Official business account).
3. Add 3–5 links that show independent coverage of Sahara (news/directories that are not paid listings).
4. If rejected: Meta allows a new request after **30 days** — improve the evidence, then resubmit.

## Part D — Compliant opt-in for the existing contact list (≈4,295 contacts, ~2 opted in)
WhatsApp rule: a business needs **opt-in before** sending any business-initiated (template) message, and the opt-in
must clearly name the business and say the person agrees to receive its messages. Therefore Sahara **must not**
send a "do you want offers?" WhatsApp template to contacts who have not opted in — that message itself would be a
policy violation and risks number restrictions. A "utility" template must not be used for promotion either.

Meta accepts opt-in collected through any channel, e.g. a website form, SMS, an IVR call, or a signed paper form.
Compliant ways to grow consent (Sahara OS records each one; the consent guard already blocks marketing templates to
anyone without a recorded opt-in):
1. **Booking / landing forms:** optional, unticked "Send me offers from Sahara Cleaning Services on WhatsApp" checkbox
   — built and tested on branch `qa/whatsapp-launch-v2` (not deployed; owner deploy decision).
2. **On the job:** staff record the customer's verbal yes on the job card (one tap, with a note) — existing flow.
3. **Inbound chats:** a customer who messages Sahara first can be asked inside the 24-hour window; record the reply.
4. **SMS / e-mail invitation** to existing customers with a link to an opt-in page — note: commercial SMS in India
   needs DLT registration (TRAI); e-mail needs the SPF/DKIM/DMARC fix first (`docs/WORKSPACE_EMAIL_DNS_RUNBOOK.md`).
5. Every promotional template keeps the **"Stop promotions"** button; STOP/UNSUBSCRIBE are honoured automatically
   (tested: `npm run test:whatsapp` 11/11 on `qa/whatsapp-launch-v2`).
LIVE campaigns stay **off** until: ≥50 genuine opt-ins, an authorised test recipient (note: 9921215250 is on the
owner's protected list — choose another test number), the owner's budget approval, and a successful TEST send.

## Sources (Meta official, read 2026-10-16)
- [Official Business Accounts — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/official-business-accounts/)
- [Get opt-in for WhatsApp — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in)
- [WhatsApp Business Policy](https://business.whatsapp.com/policy)
- [Verify your business in Meta Business Suite](https://www.facebook.com/business/help/2058515294227817)
- [Add people to a business portfolio and assign assets](https://www.facebook.com/business/help/2169003770027706)
- [About ad account permissions](https://www.facebook.com/business/help/155909647811305)
Menu names in Part A follow Meta's help articles and may differ slightly in the current Business Suite layout.
