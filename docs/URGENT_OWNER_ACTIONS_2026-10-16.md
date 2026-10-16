# Urgent owner actions — 16 Oct 2026

Two deadlines outside Sahara OS. Claude did not and will not sign in to Google Admin, cPanel,
billing or DNS; these steps are for the owner (or the person who manages the website hosting).

---

## 1. Google Workspace — payment failed, suspension on 2 Nov 2026 (HIGHEST)
Evidence (register, 15 Oct): Workspace **Business Starter** payment failed repeatedly (latest 14 Oct);
Google's billing e-mails say all services for **all users** will be suspended on **2 Nov 2026**.
Suspension stops e-mail for contact@saharacleaningservices.com — which also receives the Cognito
enquiries, Google Ads / Meta notices and the backup failure alerts.

Steps (10 minutes, owner only):
1. Sign in at **admin.google.com** with the Workspace super-admin account.
2. Menu → **Billing** → **Payment accounts** → open the account → check the card (expired? blocked
   for international/recurring charges? insufficient limit?).
3. **Add or update the payment method** (a card that allows recurring international payments, or a
   bank/UPI method if offered) and set it as primary.
4. Same page → **Make a payment** / **Pay now** for the outstanding balance.
5. Menu → **Billing** → **Subscriptions** → confirm Business Starter shows **Active** (no "Suspension
   pending" banner).
6. Check that the billing e-mails stop; if the card is declined again, call your bank to allow
   recurring payments to "Google Workspace".

Done when: Subscriptions shows Active and the outstanding balance is ₹0.

---

## 2. Main website SSL certificate expires 1 Nov 2026 11:01 GMT (HIGH)
Checked 16 Oct (read-only): `saharacleaningservices.com` and `www.` use one Let's Encrypt **wildcard**
certificate `*.saharacleaningservices.com`, issued 3 Aug 2026, **expires 1 Nov 2026**. Hosting IP
192.185.129.241 (cPanel). A 90-day certificate is normally renewed ~30 days before expiry; it has
**not** renewed by 16 Oct, so automatic renewal is probably failing. From 1 Nov visitors would see a
"Not secure" warning and Google Ads / social links would break.

Not affected: `app.`, `booking.`, `crm.` (Sahara OS on the VPS, separate certificate, valid to 7 Dec,
renewed automatically by Coolify).

Steps (owner or website admin, in cPanel):
1. cPanel → **SSL/TLS Status** → look at `saharacleaningservices.com` and `www.saharacleaningservices.com`.
2. If **AutoSSL** is listed: click **Run AutoSSL** and wait. cPanel's AutoSSL issues a normal
   (non-wildcard) certificate for the domain + www, which is all the WordPress site needs.
3. If AutoSSL shows an error (e.g. "DCV failed"), copy the exact message — usually the domain's DNS
   or a `.htaccess` redirect blocks validation. Send the message to Claude for diagnosis.
4. If the wildcard was installed by hand (SSL/TLS → Manage SSL sites shows a manually installed
   certificate), ask whoever installed it (hosting provider support or the former agency) to renew it,
   or switch to AutoSSL as in step 2.
5. Verify: open https://www.saharacleaningservices.com → padlock → certificate valid until ~Jan 2027.
   Claude can re-check from outside at any time (`openssl` read-only).

Done when: the certificate's expiry date is after 1 Dec 2026.
