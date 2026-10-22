# Website redesign — Option B (separate marketing site + public API)

**Status (22 Oct 2026): built and tested LOCALLY on branch `prep/website-api-v1`. Not pushed, not deployed.**
Even when deployed, the API is **inert (404)** until the owner sets `PUBLIC_API_TOKEN` and `PUBLIC_API_HMAC_SECRET` in Coolify.
Plan: `WEBSITE_REDESIGN_PLAN_2026-10-22.md` (kept outside the repo).

## What exists
| Item | Where |
|---|---|
| Contract | `public-api-v1.openapi.yaml` — `POST /leads`, `GET /catalogue`, `GET /slots`. `/reviews` is deliberately deferred (the `Review` table stores customer mobiles and has no "OK to publish" flag). |
| Routes | `src/app/api/public/v1/{leads,catalogue,slots}/route.ts` |
| Booking logic (shared) | `src/server/public-booking-core.ts` — moved out of the Server Action unchanged except that it takes `{ ip }` and every refusal now also carries a machine-readable `code` (additive). `src/server/actions/public-booking.ts` is a thin wrapper, so the existing booking forms behave as before. |
| Auth | `src/lib/public-api-auth.ts` — Bearer + HMAC-SHA256 of `timestamp.body`, +/-300 s, constant-time, inert unless both secrets are set (>= 24 chars) |
| Helpers | `src/server/public-api.ts` (guard, error mapping, in-memory idempotency), `public-catalogue.ts`, `public-slots.ts` |
| Middleware | `/api/public` added to the public paths (the routes do their own auth) |
| Redirects | `redirect-map.draft.csv` (+ `build-redirect-map.js`, `old-urls.txt`): 107 old WordPress URLs -> 5 keep, 83 redirect, 19 owner-review |
| Tests | `npm run test:publicbooking` (11 tests pinning today's booking behaviour) and `npm run test:publicapi` (16 contract tests) |

## Behaviour worth knowing
- **No pricing logic on the website.** The catalogue returns final prices for a service date; a struck-through price appears only when it is genuinely above the price paid (tested for every item on a festival and a regular date), painting is never priced, inspection-only packages have no price, and the stored price on a lead is always re-computed by the CRM (the website's total is ignored).
- **Idempotency:** `Idempotency-Key` header; successes are remembered 24 h in memory. An identical retry replays the answer, the same key with a different body is `422`, failures are never remembered. After a CRM restart a retry is still safe because the booking logic updates the open enquiry for the same mobile + service.
- **Throttling is per visitor:** the website server passes `client.ip`; the booking logic's existing limits (10 per IP, 5 per mobile, 10 minutes) apply to that visitor, plus a 600/minute flood limit for the whole API.
- **The honeypot is not revealed:** it answers like any validation error.

## Tests: what they guard, and proof they bite
Characterisation: validation messages and codes, honeypot, lead/follow-up/timeline/customer/acknowledgement/alert, duplicate handling, one acknowledgement per day, "browser estimate / advance paid is never trusted", server re-pricing, inspection-only properties, opt-in, attribution, throttling.
Contract: inert 404; auth (token, timestamp edge, tampered body, stale/future); 401 body; request-shape 400s; 413; business refusals -> status + code; idempotent replay, mismatch, concurrent duplicates, un-pinned failures; per-visitor throttling; server pricing; catalogue shape/ETag/304/determinism; honest-pricing invariants; price parity with the booking wizard's own pricing code; slot clamping and no internals leaked.
Mutation-checked: removing the replay window, ignoring auth failures, removing idempotency, faking a strike price, or leaking the honeypot code each made a test fail (files restored afterwards).
**Not covered yet:** slot-full rejection, the quotation-link booking path, the WhatsApp template branch, upsell events, booking-link close-out, festival-window pricing at booking time (clock dependent), the live HTTP layer (handlers are called directly with real `NextRequest`s; the middleware change is not exercised).

## Before any of this goes live
1. Owner approval to merge to `coolify-deploy` (it changes the production booking path: the Server Action now calls the core).
2. Owner enters `PUBLIC_API_TOKEN` and `PUBLIC_API_HMAC_SECRET` in Coolify (>= 24 characters each), and the same pair in the website's environment. Nothing works (404) before that.
3. Smoke test after deploy: existing `booking.*` form submits a test lead; unsigned call to `/api/public/v1/catalogue` is 404 (unset) or 401 (set).
4. Review the 19 REVIEW rows in the redirect map.
