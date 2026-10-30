import { TIME_SLOTS } from "@/lib/constants";

// Which website bookings are confirmed instantly (see server/public-auto-confirm.ts). Pure - unit-tested.

export const AUTO_CONFIRM_DEFAULT_FROM = "2026-11-06";
const FIXED_PRICE_CATEGORIES = new Set(["HOME_DEEP_CLEANING", "INDIVIDUAL_CLEANING", "PEST_CONTROL"]);

export type AutoConfirmResult = { confirmed: true; jobId: string; jobNumber: string; bookingUrl: string | null } | { confirmed: false; reason: string };

/** Pure eligibility rule (unit-tested). */
export function autoConfirmEligible(
  input: { serviceDate?: string | null; timeSlot?: string | null; serviceCategory?: string | null; inspectionRequired: boolean },
  env: Record<string, string | undefined> = process.env,
): { ok: true } | { ok: false; reason: string } {
  if ((env.PUBLIC_AUTO_CONFIRM ?? "on").toLowerCase() === "off") return { ok: false, reason: "disabled" };
  const from = /^\d{4}-\d{2}-\d{2}$/.test(env.PUBLIC_AUTO_CONFIRM_FROM ?? "") ? env.PUBLIC_AUTO_CONFIRM_FROM! : AUTO_CONFIRM_DEFAULT_FROM;
  const ymd = (input.serviceDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return { ok: false, reason: "no-date" };
  if (ymd < from) return { ok: false, reason: "before-start-date" };
  const slot = input.timeSlot ?? "";
  if (!slot || slot === "Flexible" || !(TIME_SLOTS as readonly string[]).includes(slot)) return { ok: false, reason: "no-fixed-slot" };
  if (input.inspectionRequired) return { ok: false, reason: "inspection-required" };
  if (!FIXED_PRICE_CATEGORIES.has(input.serviceCategory ?? "")) return { ok: false, reason: "custom-quote-service" };
  return { ok: true };
}

