# Sahara OS — Meta Business Readiness & Migration Checklist

_Written 2026-09-21 as Phase 6 of the "Phase 1-10 production polish" prompt. Owner instruction: "Prepare Sahara OS for migration" — not "migrate now." Everything under "Account-side" below requires the owner's own Meta Business Manager / Facebook login, which this session neither has nor should ever ask for — see the safety rules this whole project has followed since the very first Forgot Password work. Everything under "Code-side" is what this pass actually built, verified by `tsc --noEmit` + `npm run build`, both clean._

## What this document is and isn't

This is a **readiness audit of the codebase** plus a **migration checklist for the owner to execute** in their own Meta Business Manager. It is not, and cannot be, an audit of the actual current state of Sahara Cleaning Services' Facebook Page, Instagram, Ad Account, or WhatsApp Business Account — none of that is visible from source code, and this session has no login to Meta's tools. Wherever this document says "audit," it means "here's what the code needs to look like before that piece of Meta's tooling can attach to it correctly" — the owner (or whoever holds the Meta Business Manager admin role) still has to do the actual account-side clicking.

## Code-side — done this pass

| Item | What was added | Where |
|---|---|---|
| Domain verification | Renders `<meta name="facebook-domain-verification" content="...">` on `/book` when `META_DOMAIN_VERIFICATION` is set. Meta gives you this exact string in Business Manager → Brand Safety → Domains → Add. | `src/app/book/page.tsx` |
| Open Graph / Twitter Card tags | `/book` now has proper `og:title`/`og:description`/`og:image`/`og:url` and a Twitter summary card, using the Sahara logo. Needed for a correct link preview and for Meta ad review to accept the landing page. | `src/app/book/page.tsx` |
| Meta Pixel | Loads only when `NEXT_PUBLIC_META_PIXEL_ID` is set (standard Meta base-code snippet, `PageView` on load). Renders nothing at all today — inert, matching this project's "queue/load only when configured" pattern used everywhere else (WhatsApp/SMS/Email/S3 backup). | `src/app/book/page.tsx` |
| Pixel Lead event | Fires `fbq('track', 'Lead', {...})` client-side the moment a booking is successfully submitted — the client-side half of conversion tracking. Only fires if the Pixel script actually loaded above; otherwise a silent no-op. | `src/components/public/public-booking-form.tsx` |
| WhatsApp Business Account (WABA) readiness | Already covered by Phase 5 — see `SAHARA_OS_STATUS.md`'s WhatsApp readiness entry and the redesigned `BOOKING_CONFIRMATION_META_TEMPLATE` (3-button, no visible phone number). WABA setup itself is an account-side step (see checklist below), but the message templates and webhook code that will use it are ready. | `src/lib/whatsapp.ts`, `src/lib/whatsapp-templates.ts`, `src/app/api/webhooks/whatsapp/route.ts` |

**Not done, and deliberately not attempted from code**: Conversion API (server-side event forwarding) needs a Pixel access token that only exists once the Pixel itself is created in Meta Events Manager — there's nowhere in this codebase to get one today. The plumbing question ("where would a server-side event call go") is answered by the same place `sendWhatsApp`/`sendSMS`/`sendEmail` already live (`src/lib/`), following the identical "no-op until configured" pattern — but writing that integration blind, against an API surface this session can't test with real credentials, would be guesswork. Flagged as the next code-side step once the Pixel exists.

## Account-side — the owner's migration checklist

Work through these roughly in order; several genuinely can't be started until the one above it exists.

1. **Facebook Page ownership** — Confirm Sahara Cleaning Services' Facebook Page is owned by (or has Admin access granted to) the Meta Business Portfolio you intend to use, not a personal profile. If the Page currently lives under a personal account, this is the "claim the Page into a Business Portfolio" step, done from Business Settings.
2. **Meta Business Portfolio** — Create one if it doesn't exist yet (business.facebook.com), or confirm which existing one is the target. Everything else in this checklist attaches to this Portfolio.
3. **Instagram connection** — Link the Instagram Business/Creator account to the same Business Portfolio and to the Facebook Page, so ads and the Pixel can attribute across both.
4. **Domain verification** — In Business Settings → Brand Safety → Domains, add `app.saharacleaningservices.com` (or the actual public booking domain if different). Meta gives you a meta-tag value — paste it into the `META_DOMAIN_VERIFICATION` environment variable in Coolify. No code change needed; it's already wired to read that env var (see above).
5. **Pixel** — Create a Pixel in Events Manager under this Business Portfolio. Copy its Pixel ID into `NEXT_PUBLIC_META_PIXEL_ID` in Coolify's environment variables. The base code and the Lead event are already built and will start firing the moment this is set.
6. **Conversion API** — Once the Pixel exists, generate its access token (Events Manager → Settings → Conversions API) and pass it to whoever picks up the server-side integration next — it's the one missing input for the "not done" item above.
7. **Ad Account** — Create or confirm the Ad Account under the same Business Portfolio, with the Page/Instagram/Pixel all attached to it. Nothing to run any ads yet — just get the container correctly linked before the first campaign.
8. **WhatsApp Business Account (WABA)** — Create/attach a WABA under the same Business Portfolio, then in Meta's WhatsApp Manager, add a phone number and register `booking_confirmation_v2` (the template spec in `src/lib/whatsapp-templates.ts` — submit that exact JSON) for approval. Once approved, paste the access token + phone number ID into Settings → Integrations in the app (or the `WHATSAPP_*` env vars) and set `WHATSAPP_APP_SECRET` + `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — the webhook signature check added this pass (see `SAHARA_OS_SECURITY_AUDIT.md`) needs the App Secret to actually verify anything.

## Summary table for Phase 10's final checklist

| Readiness area | Status |
|---|---|
| Domain verification (code) | Ready — needs the owner's Business Manager value pasted into env vars |
| Open Graph / social preview (code) | Done |
| Pixel base code + Lead event (code) | Ready — needs a real Pixel ID |
| Conversion API (code) | Not built — blocked on a Pixel access token that doesn't exist yet |
| WhatsApp template + webhook (code) | Ready — see Phase 5 / `SAHARA_OS_STATUS.md` |
| Facebook Page / Business Portfolio / Instagram / Ad Account (account) | Owner action required — not visible or actionable from this codebase |
