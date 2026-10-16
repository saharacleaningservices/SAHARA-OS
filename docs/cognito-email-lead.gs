/**
 * Sahara OS — Cognito Forms e-mail -> CRM lead bridge (Google Apps Script, runs on contact@saharacleaningservices.com).
 *
 * Project "Sahara Cognito to CRM" (owner's Google account). The CRM side already exists:
 * POST /api/webhook/email-lead (Bearer EMAIL_LEAD_TOKEN, de-duplicates by number, alerts Admin/Accounts/Operations).
 *
 * Script properties (Project Settings):
 *   LEAD_URL    https://crm.saharacleaningservices.com/api/webhook/email-lead   (not a secret)
 *   LEAD_TOKEN  same value as EMAIL_LEAD_TOKEN in Coolify (SECRET - never put it in this file or in GitHub)
 *   DRY_RUN     optional. "true" = parse and log what WOULD be sent (last 4 digits only), call nothing, label nothing.
 *   HMAC_SECRET optional. Same value as EMAIL_LEAD_HMAC_SECRET in Coolify (SECRET). When set, every request is signed:
 *               X-Sahara-Timestamp + X-Sahara-Signature (HMAC-SHA256 of "<timestamp>.<body>"). Set it here and in
 *               Coolify together — once the CRM has the secret it rejects unsigned requests.
 *
 * Behaviour:
 *  - Reads only mails from notifications@cognitoforms.com from the last 14 days (LOOKBACK) that carry neither label.
 *  - CRM accepted (HTTP 2xx)  -> label CRM-synced (never sent again).
 *  - CRM refused / unreachable -> NOT labelled, retried by the next 5-minute run; the owner is e-mailed once per day.
 *  - Mail without a usable phone number -> label CRM-skipped (stays visible in Gmail, not retried forever).
 *  - The CRM also de-duplicates: an open lead (or one created in the last 24 h) for the same number only gets a note
 *    + an alert instead of a second lead, so a retry after a timeout can never create duplicate leads.
 *  - Nothing is ever sent to the customer by this script.
 */
var LABEL = "CRM-synced";
var SKIP_LABEL = "CRM-skipped";
var LOOKBACK = "newer_than:14d"; // first run also back-fills enquiries missed in the last 14 days (use DRY_RUN first)

function processCognitoEmails() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("LEAD_URL");
  var token = props.getProperty("LEAD_TOKEN");
  var dryRun = String(props.getProperty("DRY_RUN")).toLowerCase() === "true";
  if (!url || (!token && !dryRun)) throw new Error("Set LEAD_URL and LEAD_TOKEN in Script properties first.");
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var label = dryRun ? null : GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
    var skip = dryRun ? null : GmailApp.getUserLabelByName(SKIP_LABEL) || GmailApp.createLabel(SKIP_LABEL);
    var failed = 0;
    var threads = GmailApp.search("from:notifications@cognitoforms.com -label:" + LABEL + " -label:" + SKIP_LABEL + " " + LOOKBACK, 0, 30);
    threads.forEach(function (thread) {
      var msg = thread.getMessages()[0];
      var lead = parseCognito(msg.getPlainBody());
      if (!lead.mobile || lead.mobile.replace(/\D/g, "").length < 10) {
        if (dryRun) console.log("DRY_RUN: would skip a mail without a usable phone number");
        else thread.addLabel(skip);
        return;
      }
      if (dryRun) {
        console.log("DRY_RUN: would send enquiry (phone ending " + lead.mobile.slice(-4) + ", service: " + lead.service + ")");
        return;
      }
      var payload = JSON.stringify(lead);
      var res = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        headers: signedHeaders(token, payload, props.getProperty("HMAC_SECRET")),
        payload: payload,
        muteHttpExceptions: true,
      });
      var code = res.getResponseCode();
      if (code >= 200 && code < 300) thread.addLabel(label);
      else {
        failed++;
        console.error("CRM returned " + code + " for thread " + thread.getId());
      }
    });
    // Nothing is lost silently: failed threads stay unlabelled (retried in 5 minutes) and the owner is e-mailed once a day.
    if (failed > 0) alertOwner(failed);
  } finally {
    lock.releaseLock();
  }
}

/** Bearer header, plus the HMAC signature headers when a secret is configured (signs the exact payload sent). */
function signedHeaders(token, payload, secret) {
  var headers = { Authorization: "Bearer " + token };
  if (!secret) return headers;
  var ts = String(Math.floor(Date.now() / 1000));
  var bytes = Utilities.computeHmacSha256Signature(ts + "." + payload, secret);
  var hex = bytes
    .map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? "0" + v : v;
    })
    .join("");
  headers["X-Sahara-Timestamp"] = ts;
  headers["X-Sahara-Signature"] = "sha256=" + hex;
  return headers;
}

function alertOwner(count) {
  var props = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
  if (props.getProperty("LAST_ALERT_DAY") === today) return; // at most one e-mail per day
  props.setProperty("LAST_ALERT_DAY", today);
  MailApp.sendEmail(Session.getActiveUser().getEmail(), "Sahara: " + count + " Cognito enquiry(ies) could not reach the CRM",
    "The Cognito -> CRM bridge could not deliver " + count + " enquiry(ies). They are still in Gmail (unlabelled) and will be retried every 5 minutes. " +
    "Check that the CRM is up and that LEAD_TOKEN matches EMAIL_LEAD_TOKEN in Coolify.");
}

/** "Entry Details Name X Phone Y Subject Z Email E Message ..." -> payload for the CRM endpoint. */
function parseCognito(body) {
  var t = String(body).replace(/\s+/g, " ");
  var pick = function (label, next) {
    var m = t.match(new RegExp(label + "\\s+(.*?)\\s+(?:" + next + ")\\b"));
    return m ? m[1].trim() : "";
  };
  var name = pick("Name", "Phone");
  var phone = pick("Phone", "Subject|Email|Message");
  var subject = pick("Subject", "Email|Message");
  var email = pick("Email", "Message|Location");
  var mm = t.match(/Message(?: us)?\s+(.*?)(?:\s+View full entry|\s+Entry Details|$)/);
  return {
    name: name,
    mobile: phone.replace(/[^\d+]/g, ""),
    service: subject,
    email: email,
    message: mm ? mm[1].trim() : "",
    source: "Cognito Form",
  };
}

/** Local parse check: logs the parsed fields of a made-up sample. Makes no network call. */
function testParse() {
  var sample = "Sahara Cleaning Form View full entry at CognitoForms.com. Entry Details Name Test Person Phone 9000000000 Subject Home cleaning Email test@example.com Message us Need a 2 bhk clean";
  console.log(JSON.stringify(parseCognito(sample)));
}
