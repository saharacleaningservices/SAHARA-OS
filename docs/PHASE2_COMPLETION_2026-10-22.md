# Phase 2 completion log — 22 Oct 2026

Branch `feat/invoice-tax-engine` (PR #36 into `coolify-deploy`). Not merged; the owner merges. Nothing is sent to Meta until the Super Admin clicks the button.

## Built
| Area | What | Tests |
|---|---|---|
| Billing | Per-booking flat/percent discount and optional 18% GST (CGST 9% + SGST 9%, customer GSTIN). Admin, Accounts and Operations share one permission, no cap. GST off by default. | `npm run test:billing` (10) |
| Invoice | `/booking/invoice/{token}`: line items, discount, GST, advance, balance, exact-balance UPI QR. No scope/equipment/terms. | checked over HTTP on a production build |
| Quotation | `/booking/quotation/{token}`: reference IDs, Service Catalog scope, equipment and full T&C, separated by dividers. | same |
| Reference IDs | Customer ID (`CUST-####`), Booking/Job ID, Quotation ID, Invoice ID — all read from the database. | same |
| A4 PDF | CRM "A4 PDF" buttons open the document with `?print=1`; the browser's Save-as-PDF dialog opens at once (A4 print layout). | manual |
| Service Catalog | Table `ServiceCatalog`, page `/service-catalog`, Admin editor, defaults for the nine services. Entries show Draft until the owner approves them. | `npm run test:catalog` (5) |
| Queue | SQLite `OutboxJob` queue (no Redis): atomic claim, back-off retries, stale-lock recovery, dedupe. | `npm run test:queue` (9) |
| Crew card | `/crew-card/{jobId}.{signature}`: signed link, customer phone and amounts are never selected. Sent with each crew dispatch message. | `npm run test:queue` |
| Auto messages | View Estimate on quotation creation; View Invoice (+ Pay link) on job completion. Kill-switch `WHATSAPP_DOC_LINKS=off`. TEST mode still blocks real customers. | `npm run test:queue` |
| Meta | Super Admin "Submit to Meta" card on the WhatsApp Log page (allow-list, protected WABA refused, no duplicates). | `npm run test:metasubmit` (7) |

## Owner actions still needed
- Merge PR #36 after review. New tables and columns are created by `scripts/db-setup.mjs` on boot.
- Coolify env: `BOOKING_URL=https://booking.saharacleaningservices.com`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_ID` (names only; values entered by the owner).
- WhatsApp Log page, Super Admin: Submit `sahara_payment_received_v1` and `sahara_booking_confirmed_v5`; check status.
- Read through the Draft entries in the Service Catalog and tick "approved".
- Switch `WHATSAPP_COMPLETED_TEMPLATE=v1` (with `WHATSAPP_USE_TEMPLATES=on`) only after `sahara_job_completed_v1` is approved.

## Not done, and why
- WhatsApp group posting: the Cloud API cannot post to groups. Crew get one masked card each.
- `sahara_booking_confirmed_v5` kept Utility, with no social links, per the owner's earlier decision (socials/urgency would make Meta classify it Marketing).
- Meta submission itself: needs the Super Admin session and the owner's credentials.
