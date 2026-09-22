# Booking Flow

## The full lifecycle

```
Customer submits /book
        ↓
   Lead created (stage: NEW)
        ↓
Staff follows up, may generate a Quotation (stage: QUOTATION)
        ↓
Customer confirms → confirmBooking() creates a Job (stage: CONFIRMED / JOB_SCHEDULED)
        ↓
Job is worked: ASSIGNED → ON_THE_WAY → STARTED → COMPLETED
        ↓
On completion: a Payment record + a Sahara-native Invoice are both created
        ↓
Customer can also receive a Quotation → Invoice directly (bypassing a Job),
        e.g. for a walk-in customer — see the Invoices page's "Create Invoice"
```

## Public booking form (`src/app/book/page.tsx` + `src/components/public/public-booking-form.tsx`)

- No login required. Only Full Name, Mobile, Address, Preferred Date and
  Preferred Time are required to submit (2026-09-22 "quick booking"
  redesign) — everything else (Alternative Mobile, exact service type,
  package, Google Maps location) is optional and never blocks submission.
- Categories: Home Cleaning, Commercial Cleaning, Interior Painting, Pest
  Control, Customized Service (true multi-select — see the component's
  `customizedServices` state), Combo Package.
- Submits via the `publicBookLead` Server Action
  (`src/server/actions/public-booking.ts`), which creates a `Lead` with
  `source` set from the URL's `?source=`/`?src=` param (defaults to
  `WEBSITE`), a same-day high-priority follow-up, a timeline entry, and
  fires (queued) WhatsApp confirmations and an owner notification.
- Pricing is never shown to the public — `estimatedAmount` is still computed
  and sent to the server internally (so staff can see a suggested figure),
  it's just not rendered in the UI.
- The honeypot field `website` (hidden, must stay empty) blocks basic bots.

## Referral / attribution tracking

- `referralCodeForMobile(mobile)` (`src/server/public-job.ts`) generates a
  deterministic `SAHARA-<last 4 digits of mobile>` code, shown to a customer
  on their own booking-confirmation page (`/j/[jobNumber]`) as a "refer a
  friend" link they can share — this is a real per-customer code, not a
  generic placeholder.
- `source` on a Lead is separate from this — it tracks how THIS booking was
  attributed (`WEBSITE`, `GMB`, `FACEBOOK`, `INSTAGRAM`, a referral code if
  `?ref=` was present, etc.), read from the booking form's query params.
- Staff-shared personalized links (from a Lead/Job's "Send Booking Link"
  action) are a separate mechanism (`src/server/actions/booking-links.ts`),
  using a random token (`?bl=`), not the referral code.

## Confirming a booking into a Job

`confirmBooking` (`src/server/actions/leads.ts`) is the single entry point
used whether the enquiry started on the website, was entered manually, or
came from a Google Business Profile lead. It:
- Creates the `Job` row (customer/address/service copied from the Lead),
- Uses `Lead.quoteAmount` (falling back to `MIN_JOB_VALUE`) as `Job.jobValue`,
- Sends the "premium" WhatsApp booking-confirmation message
  (`premiumBookingConfirmationMessage` in `src/lib/whatsapp-templates.ts`) —
  de-duplicated so it's never sent twice for the same Lead.

## Job completion → Invoice + Payment

`updateJobStatus`/the completion path in `src/server/actions/jobs.ts`, once
a Job's status becomes `COMPLETED`:
- Creates a `Payment` row (the historical "invoice number" source of truth —
  `Payment.invoiceNumber`),
- Creates a Sahara-native `Invoice` row linked to that Job and Payment
  (status `ISSUED`),
- Sends a review-request WhatsApp message (once).

## Quotation → Invoice (added 2026-09-22)

A Quotation can also be converted directly into an Invoice without going
through a Job — `convertQuotationToInvoice` in
`src/server/actions/quotations.ts`, reachable from the Quotations list page
(`/quotations`). This is for cases where a customer accepts a quote and pays
without a scheduled job being the billing trigger. See
`SAHARA_DEVELOPER_HANDOVER/CRM_MODULES.md`'s Quotations/Invoices section for
the full status-workflow.

## Public booking confirmation page (`/j/[jobNumber]`)

No login required. Shows the customer their booking details, before/after
photos once available, their referral link, a WhatsApp Pay-Advance
shortcut, and Google Review prompt. Reads through
`getPublicJobSummary` (`src/server/public-job.ts`).
