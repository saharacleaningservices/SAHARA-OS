import { needsInspection } from "@/lib/pricing-master";

// CRM New Lead: how the "Estimated Amount" reacts when the package / property type changes.
// Rule: an amount the form filled in by itself (AUTO) must never survive into a selection that has no
// package price (4 BHK+, villa, bungalow, other, or no price). A figure staff typed (MANUAL) is kept,
// but the UI warns that the final quote requires a site inspection.

export type EstimateSource = "NONE" | "AUTO" | "MANUAL";
export type EstimateState = { amount: number | null; source: EstimateSource };
export type EstimateContext = { propertyType?: string | null; price: number | null };
export type EstimateResult = EstimateState & {
  /** PRICED = a package price applies; INSPECTION = site inspection required; UNPRICED = no package price. */
  mode: "PRICED" | "INSPECTION" | "UNPRICED";
  /** True when a manual staff estimate is kept on a selection that needs inspection / has no package price. */
  warnManual: boolean;
};

export function resolvePackageEstimate(prev: EstimateState, ctx: EstimateContext): EstimateResult {
  const inspection = needsInspection(ctx.propertyType);
  if (!inspection && ctx.price != null) {
    // A priced package: refresh an auto estimate, never overwrite a manual one.
    if (prev.source === "MANUAL") return { amount: prev.amount, source: "MANUAL", mode: "PRICED", warnManual: false };
    return { amount: ctx.price, source: "AUTO", mode: "PRICED", warnManual: false };
  }
  const mode = inspection ? "INSPECTION" : "UNPRICED";
  // No package price: drop the stale auto estimate.
  if (prev.source === "AUTO") return { amount: null, source: "NONE", mode, warnManual: false };
  const keptManual = prev.source === "MANUAL" && !!prev.amount && prev.amount > 0;
  return { amount: prev.amount, source: prev.source, mode, warnManual: keptManual };
}
