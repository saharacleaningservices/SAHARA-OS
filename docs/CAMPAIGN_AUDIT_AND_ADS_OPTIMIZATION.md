# Google Ads & Meta Ads — campaign audit and optimisation plan (2026-10-16)

Sources (no new log-in was possible this session — browser automation was blocked by the session safety guard):
the read-only Google Ads audit of 2026-10-05 and the account/ownership checks of 2026-10-15
(`docs/OWNERSHIP_RECOVERY_PLAN.md`, `docs/MASTER_TASK_REGISTER.md` SOS-07/SOS-08), the live landing pages and the
Sahara OS code. Nothing was changed in any ad account.

## 1. Google Ads (account 988-668-0860, owned by Sahara; Brand Make manager access removed 15 Oct)
| Finding (evidence) | Impact | Fix |
|---|---|---|
| Main campaign "Home Cleaning Search Camapign \| Pune \| Feb'26": ₹90,963 spend, 6,011 clicks, CTR 16.5%, 1,908 "conversions" at ₹47.67 | Looks cheap, but… | …judge on CRM-qualified leads, not platform conversions |
| ~1,590 of 1,908 conversions are **"phone call leads"** (only 419 real calls); goal "Phone call lead — needs attention" | Conversion data inflated → Smart bidding optimises for the wrong thing | One primary conversion = landing-form submit (Sahara OS fires exactly one per lead); calls as secondary |
| Location "presence **or interest**" → ~**58%** of spend outside the 8 km radius | Waste | **Presence only**; 5 East Pune zones (`docs/ads-audit-east-pune.md` §3) |
| "cleaning services near me" ≈ 48% of spend | Not a waste keyword — the location setting was | Keep the keyword, fix location |
| Competitor / low-value small-job / job-seeker terms | Waste | Shared negative list (`docs/ads-audit-east-pune.md` §2) |
| Ad text "Lowest Cost Guaranteed" | Unsubstantiated claim (policy + trust risk) | Replace with "Pay after service", "Trained in-house staff", "Serving Pune since 2012" |
| Final URLs on `promo.` (Brand Make server, GTM container of unknown owner) | No Sahara-owned tracking; third-party control | Move to `booking.saharacleaningservices.com/landing/*` after PR #5 is live |
| Funds exhausted, no spend since August | Safe pause | — |

## 2. Meta Ads
| Finding | Fix |
|---|---|
| Old campaigns live in ad account `343079872519451` **outside** the business portfolio | Confirm owner; claim only if Altaf's own, else new Sahara-owned account (INR, Asia/Kolkata) |
| 3 old campaigns switched **On** with "Payment error" | Switch **Off before** adding any payment method |
| No Pixel/dataset in the portfolio; Pixel ID not set in Coolify | Create a portfolio-owned dataset; set `NEXT_PUBLIC_META_PIXEL_ID` (build-time) |
| **Pixel deduplication:** the booking form sent the Meta `Lead` event **twice** per booking | **Fixed** in release PR #5 (one Lead per submit, tested) |
| Business Verification not done | Required for green tick and some ad features — `docs/META_BUSINESS_GREEN_TICK_SETUP.md` |
| Conversions API (server-side) not set up | Later: needs a Pixel access token (owner) → add CAPI with the same `event_id` as the browser event for dedup |

## 3. Landing pages (Google Ads compliance + conversion) — live check 16 Oct
Present on `/landing/home-deep-cleaning-pune`: privacy-policy and terms links, phone + WhatsApp, GSTIN, "Since 2012",
`noindex` (ad-only page), short form (name + mobile, mobile opens the numeric keypad), hidden honeypot, "Pay After
Service". Server response 0.26–0.42 s. Mobile PageSpeed (booking.) Performance 70 → hero image cut from 145 KB to
~30 KB and logo 86→29 KB in PR #5; re-measure after deploy.
Recommendations: keep one primary CTA ("Book Now"/form) above the fold; show the Google rating only from the Settings
value that matches the live Google profile; add the same `utm_content` zone tag to every ad (attribution).

## 4. Verdict — optimise the old campaigns or start fresh?
**Start a fresh, Sahara-owned structure; keep the old account and history untouched.**
Reasons: conversion data is inflated by call-leads, location targeting leaked ~58% of spend, landing pages and tracking
were on a third-party server, and the Meta account sits outside the portfolio. Re-using the old campaigns would carry
that learning forward.

Fresh structure (owner approves budget first):
1. Google: one Search campaign per service line (Home deep cleaning, Pest control, Painting, Facility management),
   ad groups by intent; Presence-only East Pune zones; shared negatives; final URLs = `booking.…/landing/*`; primary
   conversion = form submit; start with Maximise Clicks or manual CPC for 2–3 weeks, then Maximise Conversions.
2. Optional experiment: duplicate the old main campaign as a 50/50 experiment against the new one for 2–3 weeks; decide
   on **CRM cost per booked job**, not platform conversions.
3. Meta: new owned ad account; Leads objective to the landing pages; Pixel Lead (deduplicated) as the event.

## 5. Owner prerequisites (in order)
Merge PR #5 → set GA4 / Google Ads / Meta Pixel IDs in Coolify (build-time) → one tagged test lead verified in Tag
Assistant / Meta Test Events → Meta: old campaigns Off, ad account ownership, Business Verification → budget approval.
