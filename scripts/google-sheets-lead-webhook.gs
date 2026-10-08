/**
 * Sahara OS → Google Sheets lead copy (Google Apps Script web app).
 *
 * Setup (owner, one time):
 *  1. Open the lead Google Sheet → Extensions → Apps Script → paste this file.
 *  2. Project Settings → Script properties → add LEADS_SHEET_WEBHOOK_SECRET
 *     (a long random value; never commit it or share it in chat).
 *  3. Deploy → New deployment → Web app → Execute as: Me ·
 *     Who has access: Anyone → copy the /exec URL.
 *  4. In Coolify set LEADS_SHEET_WEBHOOK_URL (the /exec URL) and
 *     LEADS_SHEET_WEBHOOK_SECRET (same value as step 2), then redeploy.
 *
 * Sahara OS posts one JSON row per new website lead, after saving it in the CRM.
 */
const SHEET_NAME = "Leads";
const COLUMNS = ["timestamp", "name", "phone", "locality", "service", "package", "actual_price", "page_source", "utm_source", "utm_campaign"];

function doPost(e) {
  const out = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: "bad json" });
  }
  const secret = PropertiesService.getScriptProperties().getProperty("LEADS_SHEET_WEBHOOK_SECRET");
  if (!secret || body.secret !== secret) return out({ ok: false, error: "unauthorized" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);
    // Prefix "'" so phone numbers / formulas are stored as plain text.
    sheet.appendRow(COLUMNS.map((c) => (body[c] == null ? "" : typeof body[c] === "number" ? body[c] : "'" + String(body[c]).slice(0, 300))));
  } finally {
    lock.releaseLock();
  }
  return out({ ok: true });
}
