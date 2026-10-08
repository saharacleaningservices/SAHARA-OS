// Optional copy of each new website lead to the owner's Google Sheet via a
// Google Apps Script web app (scripts/google-sheets-lead-webhook.gs). The CRM
// stays the source of truth: this runs only AFTER the lead is saved, never
// blocks or fails the booking, and is off until the owner sets both env vars
// in Coolify (LEADS_SHEET_WEBHOOK_URL, LEADS_SHEET_WEBHOOK_SECRET).

export type LeadSheetRow = {
  timestamp: string;
  name: string;
  phone: string;
  locality: string;
  service: string;
  package: string;
  actual_price: number | null;
  page_source: string;
  utm_source: string;
  utm_campaign: string;
};

export async function copyLeadToSheet(row: LeadSheetRow): Promise<void> {
  const url = process.env.LEADS_SHEET_WEBHOOK_URL;
  const secret = process.env.LEADS_SHEET_WEBHOOK_SECRET;
  if (!url || !secret || !url.startsWith("https://script.google.com/")) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, ...row }),
      signal: ctrl.signal,
      redirect: "follow",
    });
  } catch (e) {
    console.error("[lead-sheet] copy failed:", e instanceof Error ? e.message : e);
  } finally {
    clearTimeout(timer);
  }
}
