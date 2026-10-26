# Email migration audit — Google Workspace → Hostinger mail (2026-10-25)

Read-only audit of the repository, public DNS and existing docs. **No DNS, mailbox or account was changed.** Items marked *OWNER* need a login only the owner has.

## 0. Deadline that matters most
Google Workspace (Business Starter) payment failed repeatedly; Google's notices say **all services for all users are suspended on 2 Nov 2026** (see `docs/URGENT_OWNER_ACTIONS_2026-10-16.md`). Until the migration is finished and verified, **keep Workspace paid** — a suspension stops `contact@` (which also receives Cognito enquiries, ad-platform notices and backup-failure alerts). Do not cancel Workspace on the migration day; cancel only after a full week of clean mail on Hostinger.

## 1. Addresses used by the code and docs
| Address | Where it appears | Role |
|---|---|---|
| `contact@saharacleaningservices.com` | `src/lib/marketing-content.ts` (public contact), `src/lib/email-signature.ts`, `public/llms.txt`, JSON-LD schema (`src/lib/seo-schema.ts`), PDFs/quotation footers, `src/lib/webpush.ts` (VAPID subject) | **Primary public + operational mailbox** — highest impact |
| `admin@`, `operations@`, `accounts@`, `supervisor@`, `staff@` | `src/lib/constants.ts` (CRM login IDs / seed users), `scripts/db-setup.mjs`, `scripts/test-phase1.cjs` | CRM **usernames**. They do not need a working mailbox to log in. They matter only if "Forgot password / login ID" mail is delivered to them |
| Seed/user records in the database | `dev.db` and the production volume | Contain the addresses above; changing a mailbox does not change them |

How the app sends mail: `src/lib/email.ts` is an HTTPS API abstraction (`EMAIL_API_KEY`, `EMAIL_ENDPOINT`, `EMAIL_FROM`). **No email provider is configured in production today**, so the app does not send mail through Google or SMTP — the Workspace migration does not break any app sending. Hostinger's free mailbox is SMTP/IMAP, which this file does not use; if the app should send mail later, use a transactional provider (Resend, Postmark and similar) with a verified `EMAIL_FROM` on this domain.

## 2. Inbound mail the business depends on (must keep working)
1. **Cognito form notifications → CRM** (`docs/cognito-email-lead.gs`, Apps Script reading Gmail threads and labelling `CRM-synced` / `CRM-skipped`). This script lives in the **Google account** and reads Gmail. After the move it stops. It is not installed/triggered yet (`docs/MASTER_TASK_REGISTER.md`, SOS-06), so decide: re-point Cognito notifications to a mailbox the CRM can read (forwarding to a Gmail the owner keeps, or the CRM email-lead webhook `/api/webhook/email-lead` called by another route), or drop it.
2. **GitHub Actions backup/uptime failure alerts** go to the account e-mail on GitHub.
3. **Platform notices** (Google Ads, Meta, Namecheap, Hostinger, Coolify) — see §3.

## 3. Third-party registrations to re-point (confirm the contact e-mail on each; all *OWNER*)
| Service | What to check / change |
|---|---|
| Google Search Console | Ownership may be verified through the Workspace Google account — add a second owner and a DNS TXT verification before Workspace is closed |
| Google Business Profile (both listings) | Owner/manager Google account and contact e-mail |
| Google Analytics 4 (`G-74EZWDS33Z`) and Google Ads | Admin users are Google accounts: make sure a personal Google account (not only the Workspace one) has admin |
| Google Drive backups | The daily backup uploads to Drive **as the owner's Google account** (OAuth). If that account is a Workspace user, closing Workspace deletes the backup folder. Move the backup to a personal Google account first, or keep the Workspace subscription |
| Meta Business Manager / ad account / WhatsApp Business | Business e-mail and admin logins; ad-account contact e-mail |
| GitHub | Account e-mail and notification address |
| Namecheap (DNS / domain registrar) | Account e-mail, 2FA recovery |
| Hostinger (VPS) and Coolify | Account e-mail, billing e-mail |
| Payment gateways / UPI / bank notices | Whatever address they mail receipts to |
| MyBillBook | Login e-mail |
| Cognito Forms | Notification e-mail (§2) |
| Email signature | `src/lib/email-signature.ts` — only the visible address; no change unless the address changes |

## 4. DNS (public lookup 2026-10-25)
- Name servers: Namecheap (`dns1/dns2.registrar-servers.com`).
- **MX records currently point to Google** (`aspmx.l.google.com` priority 1, `alt1/alt2.aspmx.l.google.com` priority 5, `aspmx2/3.googlemail.com` priority 10).
- TXT records exist (SPF and others) and a `default._domainkey` DKIM record exists; **no `_dmarc` record and no `google._domainkey` record** were found. Print the full TXT set from the Namecheap panel before changing anything.
- `www` → 192.185.129.241 (cPanel website host); `app` / `booking` / `crm` → 187.53.134.175 (VPS). Mail does not depend on these A records.

## 5. Zero-downtime plan (owner approval needed for every DNS change)
1. **Keep Workspace paid and active** (fix the payment first; deadline 2 Nov).
2. **Confirm what Hostinger offers.** Hostinger's free mailbox normally comes with a hosting plan — a VPS plan may not include it. Check the Hostinger panel (Emails) before relying on it; if it is not included, a hosting/Email plan is needed. *(Not verifiable from here.)*
3. Create the same mailboxes on Hostinger: `contact@` first, then only the addresses people actually read. The CRM usernames (`admin@`, `operations@` …) can stay as login names without mailboxes.
4. **Lower the TTL** on the MX and TXT records to the minimum (Namecheap) a day before the switch.
5. **Copy existing mail** from Gmail to Hostinger (IMAP migration tool in Hostinger, or Google Takeout) — do this **before** MX changes, and again after for the gap.
6. **Prepare DNS but do not switch:** note Hostinger's MX and SPF/DKIM values.
7. **Cut over in one change:** replace the five Google MX records with Hostinger's MX; replace the SPF TXT with one SPF that includes Hostinger only; add Hostinger's DKIM; add a DMARC record in monitoring mode (`p=none`) first.
8. **Test** from outside: send to and from the new `contact@`, reply to Cognito mail, check spam placement (mail-tester style check).
9. **Re-point** the registrations in §3 and move the Drive backup to an account that survives (§3).
10. **Keep Google Workspace for 7–14 days** with mail forwarding from the old mailbox, then export a final Takeout and cancel.
11. **Rollback:** restore the five Google MX records and the old SPF — mail returns within the TTL. This is why the TTL is lowered first.

## 6. Risks to avoid
- Cancelling Workspace before the backup account, Search Console / GA4 / Ads / GBP owners, and Cognito notifications are moved.
- Two SPF records (invalid) or leaving Google's SPF/DKIM while sending from Hostinger.
- Changing the name servers (that would move the whole zone, including the website and the VPS records); only edit records inside the existing Namecheap zone.

---

## 7. DNS records to enter at Namecheap (prepared 2026-10-25 — nothing has been changed)

> **Confirm every value in Hostinger hPanel → Emails → DNS records / "Connect domain" before entering it.** The values below are Hostinger's documented defaults; hPanel shows the exact ones for your mailbox plan and may differ. Also confirm that your Hostinger plan actually includes mailboxes (a VPS plan on its own may not).

Enter these at **Namecheap → Domain List → Manage → Advanced DNS** (host `@` = the root domain). Do not change the name servers.

| Type | Host | Value | Priority / TTL |
|---|---|---|---|
| MX | @ | `mx1.hostinger.com` | 5 |
| MX | @ | `mx2.hostinger.com` | 10 |
| TXT (SPF) | @ | `v=spf1 include:_spf.mail.hostinger.com ~all` | one SPF record only |
| CNAME (DKIM) | `hostingermail-a._domainkey` | `hostingermail-a.dkim.mail.hostinger.com` | |
| CNAME (DKIM) | `hostingermail-b._domainkey` | `hostingermail-b.dkim.mail.hostinger.com` | |
| CNAME (DKIM) | `hostingermail-c._domainkey` | `hostingermail-c.dkim.mail.hostinger.com` | |
| TXT (DMARC) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:contact@saharacleaningservices.com; fo=1` | |

Order of operations on cut-over day:
1. Mailboxes created and tested inside Hostinger; old mail copied across (§5 steps 3–5).
2. **Remove** the five Google MX records and the old Google SPF TXT; **add** the MX and SPF above (a domain must have exactly one SPF TXT).
3. Add the three DKIM CNAMEs and the DMARC TXT. The existing `default._domainkey` record belongs to the old setup — leave it until the migration is verified, then delete it.
4. After one clean week, change DMARC to `p=quarantine`.
5. Rollback: put the five Google MX records back (aspmx.l.google.com 1, alt1/alt2.aspmx.l.google.com 5, aspmx2/3.googlemail.com 10) and the old SPF; keep a screenshot of the current Namecheap records before touching anything.

## 8. Google Drive / Workspace asset plan before 2 Nov 2026
1. **Do not let the subscription lapse before this list is done.** Fix the payment first (admin.google.com → Billing).
2. **Backup account:** the daily database backup uploads to Drive as the owner's Google account. If that is the Workspace login, create or use a personal Gmail, share a new Drive folder with it, re-run the one-time OAuth for the GitHub backup (secret `GDRIVE_CREDENTIALS`, folder `GDRIVE_FOLDER_ID`), run the workflow manually once and confirm the file appears. Then copy the existing backup files across.
3. **Export everything:** admin.google.com → Data export (or Google Takeout per user) for Mail, Drive, Calendar, Contacts. Also keep the reports and workbooks stored in Drive (price lists, GBP audit, master workbook).
4. **Transfer ownership** of important Drive folders to the personal account (Drive → Share → make owner).
5. **Re-point** Search Console, GA4, Google Ads, Google Business Profile, Cognito and Apps Script to the personal account (§3).
6. **Mail:** forward `contact@` to the personal Gmail until the Hostinger mailbox is live.
7. Only then lower the plan or cancel — and keep a final export on the D: drive and a second copy off-site.
