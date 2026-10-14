/**
 * Sahara OS — Cognito Forms e-mail -> CRM lead bridge (Google Apps Script, runs on contact@saharacleaningservices.com).
 *
 * NOT INSTALLED YET (2026-10-14: the account has no Apps Script projects). The CRM side already exists:
 * POST /api/webhook/email-lead (Bearer EMAIL_LEAD_TOKEN, de-duplicates, alerts Admin/Accounts/Operations).
 *
 * Install (owner, ~5 minutes — Google asks the owner to authorise Gmail access; Claude must not do that):
 *  1. script.google.com -> New project -> paste this file.
 *  2. Project Settings -> Script properties -> add LEAD_URL = https://crm.saharacleaningservices.com/api/webhook/email-lead
 *     and LEAD_TOKEN = <the value of EMAIL_LEAD_TOKEN from Coolify> (never put the token in this file or in GitHub).
 *  3. Run  testParse  once (no network, no CRM call) and check the log, then run  processCognitoEmails  and approve access.
 *  4. Triggers -> Add trigger -> processCognitoEmails -> Time-driven -> every 5 minutes.
 *
 * Safety: only mails from notifications@cognitoforms.com are read; each processed thread gets the label CRM-synced so it
 * is never sent twice; the CRM also de-duplicates by number. No message is sent to the customer by this script.
 */
var LABEL = "CRM-synced";
var LOOKBACK = "newer_than:14d"; // first run also back-fills enquiries missed in the last 14 days; the CRM de-duplicates by number

function processCognitoEmails() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("LEAD_URL");
  var token = props.getProperty("LEAD_TOKEN");
  if (!url || !token) throw new Error("Set LEAD_URL and LEAD_TOKEN in Script properties first.");
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
    var failed = 0;
    var threads = GmailApp.search("from:notifications@cognitoforms.com -label:" + LABEL + " " + LOOKBACK, 0, 30);
    threads.forEach(function (thread) {
      var msg = thread.getMessages()[0];
      var lead = parseCognito(msg.getPlainBody());
      if (!lead.mobile) return; // not a usable enquiry; left unlabelled so it stays visible in Gmail
      var res = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + token },
        payload: JSON.stringify(lead),
        muteHttpExceptions: true,
      });
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) thread.addLabel(label);
      else {
        failed++;
        console.error("CRM returned " + res.getResponseCode() + " for thread " + thread.getId());
      }
    });
    // Nothing is ever lost silently: failed threads stay unlabelled (retried in 5 minutes) and the owner is e-mailed once.
    if (failed > 0) alertOwner(failed);
  } finally {
    lock.releaseLock();
  }
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
