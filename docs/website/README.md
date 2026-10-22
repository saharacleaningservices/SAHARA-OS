# Website redesign — prep material (Option B)

**Status (22 Oct 2026): drafts and tests only. Nothing here is deployed, enabled or linked into the running app.**
Plan: `WEBSITE_REDESIGN_PLAN_2026-10-22.md` (kept outside the repo). Decision: a separate stateless marketing app calls the CRM through a small REST layer.

| File | What it is |
|---|---|
| `public-api-v1.openapi.yaml` | Draft contract for `POST /leads`, `GET /catalogue`, `GET /slots`. `/reviews` is deliberately deferred (the `Review` table stores customer mobiles and has no "OK to publish" flag). Its `LeadRequest` fields match `publicBookingSchema` exactly (checked 22 Oct). |
| `redirect-map.draft.csv` | Draft 301 map for all 107 old WordPress URLs: 5 KEEP, 83 REDIRECT_301, 19 REVIEW (owner decision). |
| `build-redirect-map.js` + `old-urls.txt` | Regenerates the CSV from the public sitemap list: `node docs/website/build-redirect-map.js docs/website/old-urls.txt docs/website/redirect-map.draft.csv`. It fails if a URL is unmapped, duplicated or creates a redirect chain. |
| `../../tests/public-booking-characterisation.test.ts` | 11 tests pinning down what `publicBookLead` does today. Run `npm run test:publicbooking`. |

## Redirect rules
- **R1** keep: home, about, contact, privacy, services hub (same path).
- **R2** the 78 locality pages (13 services x 6 localities) go to that service's canonical page. 65 of them are near-identical copies of the Pune page (audit, 15 Oct), so this is consolidation. If locality hubs are created (owner question 5) the targets for those localities change.
- **R3** one-to-one merges of obviously equivalent pages (gallery, booking, service roots).
- **R4** unclear intent: proposed target given, `owner_review=YES` (19 rows, includes the generic `cleaning-services` and `bungalows` families, which may deserve their own pages).
Rules apply on the **new site** only after the owner approves; no WordPress/DNS change is made by this material.

## Characterisation tests: what they guard
Validation messages, honeypot, lead + follow-up + timeline + customer + acknowledgement + staff alert on a valid booking, duplicate-lead handling, one acknowledgement per day, "browser estimate / advance paid is never trusted", server-side re-pricing, inspection-only properties, marketing opt-in, attribution, and per-IP / per-mobile throttling.
Verified to bite: deliberately disabling the honeypot, trusting the browser estimate, or removing duplicate matching each made a test fail (source restored afterwards).
**Not covered yet:** slot-full rejection, the quotation-link path, the WhatsApp template branch, upsell events, booking-link close-out, festival-window pricing (clock dependent).
The tests use a throwaway SQLite DB, remove all WhatsApp / Google Sheet credentials from the process, stub Next's request-only APIs and use fake mobiles (90000000xx).

## Before any of this goes live
Owner approval; refactor `publicBookLead` into a module that takes `{ ip }` (tests first, identical behaviour); add the routes behind `PUBLIC_API_TOKEN` (unset = 404); owner enters `PUBLIC_API_TOKEN` / `PUBLIC_API_HMAC_SECRET` in Coolify; contract tests; review of the 19 REVIEW redirects.
