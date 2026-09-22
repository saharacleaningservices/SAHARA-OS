// Central source of truth for Sahara OS's public-facing URLs — added for the
// booking.saharacleaningservices.com / crm.saharacleaningservices.com domain
// split (2026-09-22 master prompt). Server-side only: several of these read
// plain (non-NEXT_PUBLIC_) env vars, so never import this from a "use
// client" component — pull the value through a server action/component prop
// instead, the same way the rest of the codebase hands secrets to the browser.
//
// Every value falls back to the single existing app.saharacleaningservices.com
// domain when the new env vars are unset, so nothing changes in production
// until the owner points DNS at the new subdomains and sets BOOKING_URL /
// CRM_URL in Coolify. See SAHARA_DEVELOPER_HANDOVER/DEPLOYMENT_GUIDE.md for
// the exact cutover steps and BACKUP_RESTORE_GUIDE.md's neighbor doc for the
// domain-migration checklist.

export const LEGACY_APP_URL = "https://app.saharacleaningservices.com";

/** Customer-facing booking form — Section 2 of the URL migration. */
export const PUBLIC_BOOKING_URL = (process.env.BOOKING_URL || LEGACY_APP_URL).replace(/\/$/, "");

/** Internal CRM/management app — Section 3 of the URL migration. */
export const INTERNAL_CRM_URL = (process.env.CRM_URL || LEGACY_APP_URL).replace(/\/$/, "");

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

// Hostnames (no protocol) used for host-based routing in middleware.ts —
// derived from the URLs above so there is only one place to configure them.
export const PUBLIC_BOOKING_HOST = hostOf(PUBLIC_BOOKING_URL);
export const INTERNAL_CRM_HOST = hostOf(INTERNAL_CRM_URL);
export const LEGACY_APP_HOST = hostOf(LEGACY_APP_URL);

// Set LEGACY_APP_REDIRECT_ENABLED="true" in Coolify only after booking.* and
// crm.* are both confirmed working end-to-end against production — see the
// URL-migration section of the developer handover docs. Off by default so
// the old app.* domain keeps behaving exactly as it does today.
export const LEGACY_REDIRECT_ENABLED = process.env.LEGACY_APP_REDIRECT_ENABLED === "true";
