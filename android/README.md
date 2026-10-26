# Sahara OS Helper (Android)

A small background app for the phones that take Sahara customer calls (owner, Francis, Shoaib). It sends **call details** (who, how long,
answered / missed) to Sahara OS, and — only if switched on — **call recordings**, so every lead's timeline shows the real call.

## What it can and cannot see
| Permission | Why |
|---|---|
| Call log | detect finished calls (answered, missed, rejected, connected outgoing) |
| Audio files (Android 13+ "Music and audio") | find the Samsung call-recording folder (`Call/`, `Recordings/Call/`) |
| Notifications / foreground service | Android requires the small "Sahara OS Helper is on" status-bar icon while it runs |
| Internet | talk to `https://crm.saharacleaningservices.com` only |

**No** SMS, MMS, OTP, contacts, location, microphone, camera or phone-state permission. CI fails the build if one appears
(`.github/workflows/android-helper.yml`).

## Install (per phone)
1. GitHub → **Actions → Android Helper APK →** latest green run → **Artifacts → sahara-os-helper-debug-apk** → unzip → `app-debug.apk`.
2. Send it to the phone, open it, allow "Install unknown apps" for that file manager/browser.
3. Open **Sahara OS Helper**: address is pre-filled; paste the **access token** (the `CALL_TRIGGER_TOKEN` value from Coolify — never share it in chat);
   type the phone's name (`Owner`, `Francis` or `Shoaib`); press **Save & start** and allow the permissions.
4. Recordings: switch **Upload call recordings** on. It switches itself off after **30 days** (the loyalty-testing window).
   The server can also close uploads for everyone with `CALL_RECORDING_UPLOADS_UNTIL=YYYY-MM-DD` in Coolify.

## How it behaves
* A call-log observer syncs seconds after each call; a 10-minute timer catches anything missed. First run reads the last 90 days (history).
* History (calls older than ~30 min when they arrive) is noted on an **existing** lead only — never a new lead, never a WhatsApp reply.
  A fresh missed call creates the lead and gets the post-call WhatsApp message (festive notice while `FESTIVAL_FULL_UNTIL` runs).
* Recordings: the app first asks the server (`check=1`); audio is sent only when that caller already has a lead. Samsung `.m4a` files are
  uploaded unchanged. Recordings play in the CRM for office roles only.
* Staff phones: install only with the staff member's agreement, and tell customers calls may be recorded.
