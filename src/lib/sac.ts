// SAC (Services Accounting Code) per service + B2B GST default (owner 2026-11-06, Task 5).
// Codes as given by the owner; the CA should confirm them before the first GSTR-1 filing that uses them.
//   Deep / commercial cleaning & housekeeping → 998533 · Pest control → 998531 · Interior painting → 995471
import { isValidGstin } from "@/lib/invoice-tax";

export const SAC_BY_SERVICE: Record<string, string> = {
  HOME_DEEP_CLEANING: "998533",
  COMMERCIAL_CLEANING: "998533",
  HOUSEKEEPING: "998533",
  PEST_CONTROL: "998531",
  INTERIOR_PAINTING: "995471",
};
export const DEFAULT_SAC = "998533";

/** SAC for a ServiceType (or a free-text service name from MyBillBook / line items). */
export function sacFor(service: string | null | undefined): string {
  if (!service) return DEFAULT_SAC;
  if (SAC_BY_SERVICE[service]) return SAC_BY_SERVICE[service];
  const s = service.toLowerCase();
  if (/pest|termite|cockroach|bed ?bug|mosquito|rodent/.test(s)) return SAC_BY_SERVICE.PEST_CONTROL;
  if (/paint|putty|waterproof/.test(s)) return SAC_BY_SERVICE.INTERIOR_PAINTING;
  return DEFAULT_SAC;
}

/** B2B parties (GST book, or a valid GSTIN on file) get 18% GST (CGST 9% + SGST 9%) pre-selected; B2C stays off. */
export function gstDefaultFor(party: { segment?: string | null; gstin?: string | null } | null | undefined): boolean {
  if (!party) return false;
  return party.segment === "B2B" || party.segment === "BOTH" || isValidGstin(party.gstin);
}
