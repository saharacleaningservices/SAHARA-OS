"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SOFA_SEATER_OPTIONS,
  SOFA_SEATER_PRICES,
  MATTRESS_SIZE_OPTIONS,
  MATTRESS_UNIT_PRICE,
  HOME_SERVICE_UNIT_PRICE,
  CUSTOMIZER_FIXED_UNIT_PRICE,
  CUSTOMIZER_UNIT_LABEL,
  CUSTOMIZED_SOFA_RATE_OPTIONS,
  PAINT_TYPE_RATE_PER_SQFT,
  PUTTY_RATE_PER_SQFT,
  PEST_PROPERTY_SIZE_OPTIONS,
  PEST_PROPERTY_SIZE_PRICES,
  HOUSEKEEPING_SHIFT_HOURS,
  HOUSEKEEPING_HOURLY_RATE,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";

/** Simple +/- quantity field. Shared by the public Booking Form V2
 * (src/components/public/public-booking-form.tsx) and the CRM New Lead
 * form's dynamic service sub-fields below, so both stay visually and
 * behaviourally identical. Defined at module scope so it keeps a stable
 * identity across re-renders. */
export function QtyStepper({
  label,
  value,
  onChange,
  min = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
}) {
  const num = Number(value) || 0;
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(String(Math.max(min, (num || min) - 1)))}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-lg font-semibold text-foreground active:scale-95"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <Input
          inputMode="numeric"
          className="w-16 text-center"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder={String(min)}
        />
        <button
          type="button"
          // For a stepper with min=0 (an optional quantity, no minimum
          // order), `num || min - 1` breaks: when num is 0, `0 || -1`
          // evaluates to -1 because 0 is falsy in JS, so the very first
          // click from empty/0 computed (-1)+1 = 0 and the button looked
          // stuck. Every other stepper on this form uses min>=1, where the
          // original expression is intentional (it jumps straight to the
          // minimum order quantity on first click) — so this only changes
          // behaviour for the new min=0 fields, never for existing ones.
          onClick={() => onChange(String((num || (min === 0 ? 0 : min - 1)) + 1))}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-lg font-semibold text-foreground active:scale-95"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Reads a Customized Service selection back out of a lead's saved Notes text
 * (the exact same line format the notes-building effect below writes), so
 * editing an existing lead reloads the Quantity/Unit Price/Estimated Amount
 * the office originally picked instead of starting blank. Matches both the
 * current "Customized Service —" prefix and the "Customizer Package —"
 * prefix this same feature briefly used earlier the same day, so leads
 * saved in between still reload correctly. A lead saved before either fix
 * (the old "Sofa Cleaning: 5 Seater = ₹1999" / Premium-Platinum-Diamond
 * text) simply won't match and the fields start blank, same as no data.
 */
function parseCustomizerSelection(notes: string | undefined, variant: string): { qty: string; unitPrice: string; mattressSize: string } {
  const empty = { qty: "", unitPrice: "", mattressSize: "" };
  if (!notes || !variant) return empty;
  const lines = notes.split("\n").map((l) => l.trim());
  const escapedVariant = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = "(?:Customized Service|Customizer Package)";

  if (variant === "Mattress Cleaning") {
    // Current format carries both the size and the (now editable) rate;
    // older leads saved before Unit Price became editable only have size —
    // matched by the second, priceless pattern so they still restore the
    // size (the rate then simply falls back to MATTRESS_UNIT_PRICE default).
    const withRate = new RegExp(`^${prefix} — Mattress Cleaning: (Single|Double) x (\\d+) × ₹(\\d+(?:\\.\\d+)?)(?:/\\S+)? = ₹`);
    const legacy = new RegExp(`^${prefix} — Mattress Cleaning: (Single|Double) x (\\d+) = ₹`);
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = lines[i].match(withRate);
      if (m) return { qty: m[2], unitPrice: m[3], mattressSize: m[1] };
      const legacyMatch = lines[i].match(legacy);
      if (legacyMatch) return { qty: legacyMatch[2], unitPrice: "", mattressSize: legacyMatch[1] };
    }
    return empty;
  }

  const pricedRe = new RegExp(`^${prefix} — ${escapedVariant}: Qty (\\d+) × ₹(\\d+(?:\\.\\d+)?)(?:/\\S+)? = ₹`);
  const unpricedRe = new RegExp(`^${prefix} \\(price to be confirmed\\) — ${escapedVariant}: Qty (\\d+)$`);
  for (let i = lines.length - 1; i >= 0; i--) {
    const priced = lines[i].match(pricedRe);
    if (priced) return { qty: priced[1], unitPrice: priced[2], mattressSize: "" };
    const unpriced = lines[i].match(unpricedRe);
    if (unpriced) return { qty: unpriced[1], unitPrice: "", mattressSize: "" };
  }
  return empty;
}

/**
 * Dynamic Service Type → quantity/size sub-fields + live suggested estimate.
 * Mirrors the Booking Form V2 logic customers already see on the public
 * booking page (Sofa seats, Mattress size + qty, Bathroom/Kitchen/Carpet/
 * Window/Curtain quantity, Painting rooms + sq ft + putty, Pest property
 * size, Housekeeping staff + shift hours) so CRM staff creating a lead by
 * hand get the exact same quantity selection and live pricing the customer
 * gets — instead of the old single flat "Details" dropdown.
 *
 * Also carries two more panels added for the overnight production batch:
 *  - Customized Service (category CUSTOMIZER_PACKAGE, display label
 *    "Customized Service" — the internal key is unchanged, see
 *    SERVICE_CATEGORY_LABELS): Service Type → Quantity → Unit Price →
 *    Estimated Amount, per the selected variant (the "Details" picker
 *    above). Unit Price is ALWAYS an editable field for every item (owner
 *    mandate 2026-09-21: "Remove fixed Unit Price. Make Unit Price
 *    editable.") — pre-filled from CUSTOMIZER_FIXED_UNIT_PRICE as a
 *    convenience default wherever one is configured (Carpet/Window/
 *    Bathroom/Refrigerator/Sofa Cleaning — see that constant's comment for
 *    exactly which existing rate each one reuses), but staff can always
 *    overwrite it; Estimated Amount is always Qty × Unit Price and stays
 *    read-only. Sofa Cleaning additionally shows one-click quick-fill chips
 *    (CUSTOMIZED_SOFA_RATE_OPTIONS — ₹200/250/300 per seat) next to the
 *    input, deliberately separate from the customer-facing ₹499/seat
 *    Booking Form upsell. Mattress Cleaning keeps a Size picker first
 *    (Single/Double genuinely have different real rates) which re-fills the
 *    same editable Unit Price with that size's default whenever it changes.
 *    Every other item (Balcony/Kitchen/Chimney/Fan/Floor Cleaning) has no
 *    default rate, so the field simply starts blank for staff to enter the
 *    real quoted price. `initialSelectionNotes` (the lead's existing Notes,
 *    passed only in edit mode) restores a previously-saved selection via
 *    `parseCustomizerSelection` above.
 *  - Individual Cleaning (category INDIVIDUAL_CLEANING): a quantity field
 *    for every item (Kitchen, Bathroom, Sofa, Mattress, Window, Curtain,
 *    Fan, Fridge, Balcony), qty-only with no price calculation — unchanged,
 *    by explicit production instruction.
 * Both panels feed the same onNotesLines callback as everything else here,
 * so the selections are saved to the lead's Notes and show on the Lead
 * Detail page. Individual Cleaning lines (and any Customized Service item
 * left unpriced) are picked up by quotation generation as $0 "price to be
 * confirmed" line items (see src/lib/ai/quotation.ts and
 * quotation-dialog.tsx); a priced Customized Service line is already folded
 * into the lead's Estimated Amount, so it isn't listed again as unpriced.
 *
 * Mount with `key={`${category}-${variant}`}` from the parent so switching
 * Service Type cleanly resets every sub-field instead of leaking a stale
 * selection (e.g. a leftover Sofa Size) into a different service.
 */
export function ServiceQuantityFields({
  category,
  variant,
  initialSelectionNotes,
  onEstimate,
  onNotesLines,
}: {
  category: string;
  variant: string;
  /** The lead's existing Notes text, passed only when editing an existing
   * lead, so a previously-saved Customizer Package selection reloads
   * instead of starting blank. Omit (or pass undefined) when creating a
   * new lead. */
  initialSelectionNotes?: string;
  onEstimate?: (amount: number) => void;
  onNotesLines?: (lines: string[]) => void;
}) {
  const isCustomizer = category === "CUSTOMIZER_PACKAGE";
  const restored = isCustomizer ? parseCustomizerSelection(initialSelectionNotes, variant) : { qty: "", unitPrice: "", mattressSize: "" };

  const [sofaSeater, setSofaSeater] = useState("");
  const [bathroomQty, setBathroomQty] = useState("");
  const [kitchenQty, setKitchenQty] = useState("");
  const [carpetQty, setCarpetQty] = useState("");
  const [windowQty, setWindowQty] = useState("");
  // mattressSize/mattressQty are shared by two different flows: the
  // Home Deep Cleaning mirror of the public Booking Form (untouched by this
  // change, still Size + its own Quantity), and Customized Service's own
  // Mattress Cleaning variant, where the Size picker stays but Quantity and
  // Unit Price now come from the same generic czQty/czUnitPrice state as
  // every other item — picking a size just re-fills czUnitPrice with that
  // size's default (see the Select's onValueChange below); the field stays
  // freely editable afterward.
  const [mattressSize, setMattressSize] = useState(() => restored.mattressSize);
  const [mattressQty, setMattressQty] = useState("");
  const [curtainQty, setCurtainQty] = useState("");
  const [paintRooms, setPaintRooms] = useState("");
  const [paintSqft, setPaintSqft] = useState("");
  const [puttyRequired, setPuttyRequired] = useState<"" | "YES" | "NO">("");
  const [pestPropertySize, setPestPropertySize] = useState("");
  const [housekeepingStaffCount, setHousekeepingStaffCount] = useState("");
  const [housekeepingShiftHours, setHousekeepingShiftHours] = useState("");

  // Customized Service (CUSTOMIZER_PACKAGE) — the single Quantity/Unit Price
  // pair used by every variant, including Mattress and Sofa. Unit Price is
  // always editable; it's only ever pre-filled with a default, never locked
  // (owner mandate 2026-09-21).
  const [czQty, setCzQty] = useState(() => restored.qty);
  const [czUnitPrice, setCzUnitPrice] = useState(() => {
    if (restored.unitPrice) return restored.unitPrice;
    if (variant === "Mattress Cleaning") {
      return restored.mattressSize ? String(MATTRESS_UNIT_PRICE[restored.mattressSize] ?? "") : "";
    }
    return variant && CUSTOMIZER_FIXED_UNIT_PRICE[variant] ? String(CUSTOMIZER_FIXED_UNIT_PRICE[variant]) : "";
  });

  // Individual Cleaning (INDIVIDUAL_CLEANING) — one qty field per item.
  const [icKitchenQty, setIcKitchenQty] = useState("");
  const [icBathroomQty, setIcBathroomQty] = useState("");
  const [icSofaQty, setIcSofaQty] = useState("");
  const [icMattressQty, setIcMattressQty] = useState("");
  const [icWindowQty, setIcWindowQty] = useState("");
  const [icCurtainQty, setIcCurtainQty] = useState("");
  const [icFanQty, setIcFanQty] = useState("");
  const [icFridgeQty, setIcFridgeQty] = useState("");
  const [icBalconyQty, setIcBalconyQty] = useState("");

  function computeEstimate(): number {
    if (category === "HOME_DEEP_CLEANING") {
      if (variant === "Sofa Cleaning" && sofaSeater) return SOFA_SEATER_PRICES[sofaSeater] ?? 0;
      if (variant === "Mattress Cleaning" && mattressSize) {
        const qty = Number(mattressQty) || 1;
        return (MATTRESS_UNIT_PRICE[mattressSize] ?? 0) * qty;
      }
      const qtyByVariant: Record<string, string> = {
        "Bathroom Cleaning": bathroomQty,
        "Kitchen Deep Cleaning": kitchenQty,
        "Carpet Cleaning": carpetQty,
        "Window Cleaning": windowQty,
        "Curtain Cleaning": curtainQty,
      };
      if (variant && HOME_SERVICE_UNIT_PRICE[variant] && qtyByVariant[variant]) {
        const qty = Number(qtyByVariant[variant]) || 1;
        return HOME_SERVICE_UNIT_PRICE[variant] * qty;
      }
    }
    if (category === "PAINTING") {
      const sqft = Number(paintSqft) || 0;
      const rate = variant ? PAINT_TYPE_RATE_PER_SQFT[variant] ?? 0 : 0;
      if (sqft > 0 && rate > 0) {
        let total = sqft * rate;
        if (puttyRequired === "YES") total += sqft * PUTTY_RATE_PER_SQFT;
        return Math.round(total);
      }
    }
    if (category === "PEST_CONTROL" && pestPropertySize) {
      return PEST_PROPERTY_SIZE_PRICES[pestPropertySize] ?? 0;
    }
    if (category === "HOUSEKEEPING" && housekeepingShiftHours && housekeepingStaffCount) {
      const hours = parseInt(housekeepingShiftHours, 10) || 0;
      const staff = Number(housekeepingStaffCount) || 1;
      return Math.round(hours * staff * HOUSEKEEPING_HOURLY_RATE);
    }
    if (category === "CUSTOMIZER_PACKAGE") {
      // Every item — Mattress and Sofa included — is now a plain
      // Quantity x (editable) Unit Price. Unit Price is pre-filled with a
      // default where one is configured, but the calculation always reads
      // the current field value, never a locked constant, so an edited
      // price is reflected immediately.
      const qty = Number(czQty) || 0;
      const rate = Number(czUnitPrice) || 0;
      if (qty > 0 && rate > 0) return qty * rate;
    }
    // Individual Cleaning is quantity-only by explicit production
    // instruction — no automatic pricing.
    return 0;
  }

  const estimate = computeEstimate();

  useEffect(() => {
    onEstimate?.(estimate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimate]);

  useEffect(() => {
    const lines: string[] = [];
    if (category === "HOME_DEEP_CLEANING") {
      if (variant === "Sofa Cleaning" && sofaSeater) lines.push(`Sofa: ${sofaSeater}`);
      if (variant === "Bathroom Cleaning" && bathroomQty) lines.push(`Bathrooms: ${bathroomQty}`);
      if (variant === "Kitchen Deep Cleaning" && kitchenQty) lines.push(`Kitchens: ${kitchenQty}`);
      if (variant === "Carpet Cleaning" && carpetQty) lines.push(`Carpets: ${carpetQty}`);
      if (variant === "Window Cleaning" && windowQty) lines.push(`Windows: ${windowQty}`);
      if (variant === "Mattress Cleaning" && mattressSize) {
        lines.push(`Mattress: ${mattressSize}${mattressQty ? ` x ${mattressQty}` : ""}`);
      }
      if (variant === "Curtain Cleaning" && curtainQty) lines.push(`Curtain Pairs: ${curtainQty}`);
    }
    if (category === "PAINTING") {
      if (paintRooms) lines.push(`Rooms: ${paintRooms}`);
      if (paintSqft) lines.push(`Area: ${paintSqft} sq ft`);
      if (puttyRequired) lines.push(`Putty Required: ${puttyRequired === "YES" ? "Yes" : "No"}`);
    }
    if (category === "PEST_CONTROL" && pestPropertySize) lines.push(`Property Size: ${pestPropertySize}`);
    if (category === "HOUSEKEEPING") {
      if (housekeepingStaffCount) lines.push(`Staff Count: ${housekeepingStaffCount}`);
      if (housekeepingShiftHours) lines.push(`Shift Hours: ${housekeepingShiftHours}`);
    }
    // Customized Service — a priced line (rate known, folded into Estimated
    // Amount above) is recorded plainly; an unpriced one (no configured rate
    // and no unit price typed yet) gets the distinct "(price to be
    // confirmed)" marker so quotation generation lists it as a $0 line
    // instead of double-counting it (see src/lib/ai/quotation.ts /
    // quotation-dialog.tsx).
    if (category === "CUSTOMIZER_PACKAGE" && variant && czQty) {
      const qty = Number(czQty) || 0;
      const rate = Number(czUnitPrice) || 0;
      const unit = CUSTOMIZER_UNIT_LABEL[variant];
      if (variant === "Mattress Cleaning" && mattressSize) {
        if (qty > 0 && rate > 0) {
          lines.push(`Customized Service — Mattress Cleaning: ${mattressSize} x ${qty} × ₹${rate}/mattress = ₹${qty * rate}`);
        } else if (qty > 0) {
          lines.push(`Customized Service (price to be confirmed) — Mattress Cleaning: Qty ${qty}`);
        }
      } else if (variant !== "Mattress Cleaning") {
        if (qty > 0 && rate > 0) {
          lines.push(`Customized Service — ${variant}: Qty ${qty} × ₹${rate}${unit ? `/${unit}` : ""} = ₹${qty * rate}`);
        } else if (qty > 0) {
          lines.push(`Customized Service (price to be confirmed) — ${variant}: Qty ${qty}`);
        }
      }
    }
    // Individual Cleaning — same "Individual Cleaning —" prefix convention.
    if (category === "INDIVIDUAL_CLEANING") {
      if (icKitchenQty && Number(icKitchenQty) > 0) lines.push(`Individual Cleaning — Kitchen Qty: ${icKitchenQty}`);
      if (icBathroomQty && Number(icBathroomQty) > 0) lines.push(`Individual Cleaning — Bathroom Qty: ${icBathroomQty}`);
      if (icSofaQty && Number(icSofaQty) > 0) lines.push(`Individual Cleaning — Sofa Qty: ${icSofaQty}`);
      if (icMattressQty && Number(icMattressQty) > 0) lines.push(`Individual Cleaning — Mattress Qty: ${icMattressQty}`);
      if (icWindowQty && Number(icWindowQty) > 0) lines.push(`Individual Cleaning — Window Qty: ${icWindowQty}`);
      if (icCurtainQty && Number(icCurtainQty) > 0) lines.push(`Individual Cleaning — Curtain Qty: ${icCurtainQty}`);
      if (icFanQty && Number(icFanQty) > 0) lines.push(`Individual Cleaning — Fan Qty: ${icFanQty}`);
      if (icFridgeQty && Number(icFridgeQty) > 0) lines.push(`Individual Cleaning — Fridge Qty: ${icFridgeQty}`);
      if (icBalconyQty && Number(icBalconyQty) > 0) lines.push(`Individual Cleaning — Balcony Qty: ${icBalconyQty}`);
    }
    onNotesLines?.(lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    category,
    variant,
    sofaSeater,
    bathroomQty,
    kitchenQty,
    carpetQty,
    windowQty,
    mattressSize,
    mattressQty,
    curtainQty,
    paintRooms,
    paintSqft,
    puttyRequired,
    pestPropertySize,
    housekeepingStaffCount,
    housekeepingShiftHours,
    czQty,
    czUnitPrice,
    icKitchenQty,
    icBathroomQty,
    icSofaQty,
    icMattressQty,
    icWindowQty,
    icCurtainQty,
    icFanQty,
    icFridgeQty,
    icBalconyQty,
  ]);

  const fieldWrap = "space-y-1.5";

  const hasFields =
    (category === "HOME_DEEP_CLEANING" &&
      ["Sofa Cleaning", "Bathroom Cleaning", "Kitchen Deep Cleaning", "Carpet Cleaning", "Window Cleaning", "Mattress Cleaning", "Curtain Cleaning"].includes(
        variant
      )) ||
    category === "PAINTING" ||
    category === "PEST_CONTROL" ||
    category === "HOUSEKEEPING" ||
    (category === "CUSTOMIZER_PACKAGE" && Boolean(variant)) ||
    category === "INDIVIDUAL_CLEANING";

  if (!hasFields) return null;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-3.5">
      <p className="text-sm font-semibold text-foreground">Service Details</p>

      {category === "HOME_DEEP_CLEANING" && variant === "Sofa Cleaning" && (
        <div className={fieldWrap}>
          <Label>Sofa Size</Label>
          <Select value={sofaSeater} onValueChange={setSofaSeater}>
            <SelectTrigger><SelectValue placeholder="Select seater" /></SelectTrigger>
            <SelectContent>
              {SOFA_SEATER_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {category === "HOME_DEEP_CLEANING" && variant === "Bathroom Cleaning" && (
        <QtyStepper label="Number of Bathrooms" value={bathroomQty} onChange={setBathroomQty} min={2} />
      )}
      {category === "HOME_DEEP_CLEANING" && variant === "Kitchen Deep Cleaning" && (
        <QtyStepper label="Number of Kitchens" value={kitchenQty} onChange={setKitchenQty} min={1} />
      )}
      {category === "HOME_DEEP_CLEANING" && variant === "Carpet Cleaning" && (
        <QtyStepper label="Number of Carpets" value={carpetQty} onChange={setCarpetQty} min={2} />
      )}
      {category === "HOME_DEEP_CLEANING" && variant === "Window Cleaning" && (
        <QtyStepper label="Number of Windows" value={windowQty} onChange={setWindowQty} min={5} />
      )}
      {category === "HOME_DEEP_CLEANING" && variant === "Mattress Cleaning" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={fieldWrap}>
            <Label>Mattress Size</Label>
            <Select value={mattressSize} onValueChange={setMattressSize}>
              <SelectTrigger><SelectValue placeholder="Single or Double" /></SelectTrigger>
              <SelectContent>
                {MATTRESS_SIZE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <QtyStepper label="Number of Mattresses" value={mattressQty} onChange={setMattressQty} min={2} />
        </div>
      )}
      {category === "HOME_DEEP_CLEANING" && variant === "Curtain Cleaning" && (
        <QtyStepper label="Number of Pairs" value={curtainQty} onChange={setCurtainQty} min={2} />
      )}

      {category === "PAINTING" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <QtyStepper label="Number of Rooms" value={paintRooms} onChange={setPaintRooms} min={1} />
            <div className={fieldWrap}>
              <Label>Square Feet (approx.)</Label>
              <Input
                inputMode="numeric"
                value={paintSqft}
                onChange={(e) => setPaintSqft(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 1200"
              />
            </div>
          </div>
          <div className={fieldWrap}>
            <Label>Putty Required?</Label>
            <div className="flex gap-2">
              {(["YES", "NO"] as const).map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setPuttyRequired(opt)}
                  className={`rounded-lg border px-4 py-2 text-xs font-semibold ${
                    puttyRequired === opt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
                  }`}
                >
                  {opt === "YES" ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {category === "PEST_CONTROL" && (
        <div className={fieldWrap}>
          <Label>Property Size</Label>
          <Select value={pestPropertySize} onValueChange={setPestPropertySize}>
            <SelectTrigger><SelectValue placeholder="Select property size" /></SelectTrigger>
            <SelectContent>
              {PEST_PROPERTY_SIZE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {category === "HOUSEKEEPING" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <QtyStepper label="Staff Count" value={housekeepingStaffCount} onChange={setHousekeepingStaffCount} min={1} />
          <div className={fieldWrap}>
            <Label>Shift Hours</Label>
            <Select value={housekeepingShiftHours} onValueChange={setHousekeepingShiftHours}>
              <SelectTrigger><SelectValue placeholder="Select shift hours" /></SelectTrigger>
              <SelectContent>
                {HOUSEKEEPING_SHIFT_HOURS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {category === "CUSTOMIZER_PACKAGE" && variant === "Mattress Cleaning" && (
        <div className={fieldWrap}>
          <Label>Mattress Size</Label>
          <Select
            value={mattressSize}
            onValueChange={(v) => {
              setMattressSize(v);
              setCzUnitPrice(String(MATTRESS_UNIT_PRICE[v] ?? ""));
            }}
          >
            <SelectTrigger><SelectValue placeholder="Single or Double" /></SelectTrigger>
            <SelectContent>
              {MATTRESS_SIZE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {category === "CUSTOMIZER_PACKAGE" && variant && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <QtyStepper label="Quantity" value={czQty} onChange={setCzQty} min={1} />
          <div className={fieldWrap}>
            <Label>Unit Price (₹{CUSTOMIZER_UNIT_LABEL[variant] ? ` / ${CUSTOMIZER_UNIT_LABEL[variant]}` : ""})</Label>
            <Input
              inputMode="numeric"
              value={czUnitPrice}
              onChange={(e) => setCzUnitPrice(e.target.value.replace(/\D/g, ""))}
              placeholder={CUSTOMIZER_FIXED_UNIT_PRICE[variant] ? undefined : "No default rate — enter the quoted price"}
            />
            {variant === "Sofa Cleaning" && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CUSTOMIZED_SOFA_RATE_OPTIONS.map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setCzUnitPrice(String(r))}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                      czUnitPrice === String(r) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
                    }`}
                  >
                    {formatINR(r)}/seat
                  </button>
                ))}
              </div>
            )}
            {!CUSTOMIZER_FIXED_UNIT_PRICE[variant] && variant !== "Mattress Cleaning" && (
              <p className="text-xs text-muted-foreground">No default rate for this service — enter the real quoted price.</p>
            )}
          </div>
        </div>
      )}
      {category === "CUSTOMIZER_PACKAGE" && variant && (
        <div className={fieldWrap}>
          <Label>Estimated Amount (₹)</Label>
          <Input value={estimate > 0 ? formatINR(estimate) : ""} disabled readOnly placeholder="Enter quantity to calculate" />
        </div>
      )}

      {category === "INDIVIDUAL_CLEANING" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Set a quantity for every item the customer wants — leave the rest at 0.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <QtyStepper label="Kitchen Qty" value={icKitchenQty} onChange={setIcKitchenQty} min={0} />
            <QtyStepper label="Bathroom Qty" value={icBathroomQty} onChange={setIcBathroomQty} min={0} />
            <QtyStepper label="Sofa Qty" value={icSofaQty} onChange={setIcSofaQty} min={0} />
            <QtyStepper label="Mattress Qty" value={icMattressQty} onChange={setIcMattressQty} min={0} />
            <QtyStepper label="Window Qty" value={icWindowQty} onChange={setIcWindowQty} min={0} />
            <QtyStepper label="Curtain Qty" value={icCurtainQty} onChange={setIcCurtainQty} min={0} />
            <QtyStepper label="Fan Qty" value={icFanQty} onChange={setIcFanQty} min={0} />
            <QtyStepper label="Fridge Qty" value={icFridgeQty} onChange={setIcFridgeQty} min={0} />
            <QtyStepper label="Balcony Qty" value={icBalconyQty} onChange={setIcBalconyQty} min={0} />
          </div>
        </div>
      )}

      {estimate > 0 && !isCustomizer && (
        <p className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground">
          Estimated from selections: <span className="font-bold">{formatINR(estimate)}</span> — filled into Estimated Amount above, you can edit it.
        </p>
      )}
      {estimate > 0 && isCustomizer && (
        <p className="text-xs text-muted-foreground">Filled into the lead&apos;s Estimated Amount field above — you can still edit it there.</p>
      )}
    </div>
  );
}
