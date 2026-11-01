// Owner-protected / internal numbers: they must never produce marketing analytics or ad-conversion events
// (Meta Pixel, Conversions API, GA4 lead, Google Ads conversion). Matching uses the last 10 digits, so
// "+91 99212 15250", "0 9921215250", "919921215250" and "99212-15250" are all the same number.
// Pure (no node/browser APIs) so the browser tracker and the server relay share one rule.

import { last10 } from "@/lib/phone";

const PROTECTED_LAST10 = new Set(["9168337130", "9921215250", "7083347130", "9175220270"]);

export { last10 };

export function isProtectedNumber(raw?: string | null): boolean {
  return PROTECTED_LAST10.has(last10(raw));
}
