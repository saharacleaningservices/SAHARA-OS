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
 * Dynamic Service Type → quantity/size sub-fields + live suggested estimate.
 * Mirrors the Booking Form V2 logic customers already see on the public
 * booking page (Sofa seats, Mattress size + qty, Bathroom/Kitchen/Carpet/
 * Window/Curtain quantity, Painting rooms + sq ft + putty, Pest property
 * size, Housekeeping staff + shift hours) so CRM staff creating a lead by
 * hand get the exact same quantity selection and live pricing the customer
 * gets — instead of the old single flat "Details" dropdown.
 *
 * Also carries two more panels added for the overnight production batch:
 *  - Customizer Package (category CUSTOMIZER_PACKAGE): Service Type →
 *    Quantity → Unit Price → Estimated Amount, per the selected variant
 *    (the "Details" picker above). Sofa/Mattress reuse the exact size-based
 *    rates Home Deep Cleaning already uses; Carpet/Window/Refrigerator reuse
 *    HOME_SERVICE_UNIT_PRICE/CUSTOMIZER_FIXED_UNIT_PRICE; every other item
 *    (Balcony/Kitchen/Chimney/Fan/Floor Cleaning) has no configured rate, so
 *    staff enter the real quoted unit price by hand — never auto-invented.
 *  - Individual Cleaning (category INDIVIDUAL_CLEANING): a quantity field
 *    for every item (Kitchen, Bathroom, Sofa, Mattress, Window, Curtain,
 *    Fan, Fridge, Balcony), qty-only with no price calculation — unchanged,
 *    by explicit production instruction.
 * Both panels feed the same onNotesLines callback as everything else here,
 * so the selections are saved to the lead's Notes and show on the Lead
 * Detail page. Individual Cleaning lines (and any Customizer Package item
 * left unpriced) are picked up by quotation generation as $0 "price to be
 * confirmed" line items (see src/lib/ai/quotation.ts and
 * quotation-dialog.tsx); a priced Customizer Package line is already folded
 * into the lead's Estimated Amount, so it isn't listed again as unpriced.
 *
 * Mount with `key={`${category}-${variant}`}` from the parent so switching
 * Service Type cleanly resets every sub-field instead of leaking a stale
 * selection (e.g. a leftover Sofa Size) into a different service.
 */
export function ServiceQuantityFields({
  category,
  variant,
  onEstimate,
  onNotesLines,
}: {
  category: string;
  variant: string;
  onEstimate?: (amount: number) => void;
  onNotesLines?: (lines: string[]) => void;
}) {
  const [sofaSeater, setSofaSeater] = useState("");
  const [bathroomQty, setBathroomQty] = useState("");
  const [kitchenQty, setKitchenQty] = useState("");
  const [carpetQty, setCarpetQty] = useState("");
  const [windowQty, setWindowQty] = useState("");
  const [mattressSize, setMattressSize] = useState("");
  const [mattressQty, setMattressQty] = useState("");
  const [curtainQty, setCurtainQty] = useState("");
  const [paintRooms, setPaintRooms] = useState("");
  const [paintSqft, setPaintSqft] = useState("");
  const [puttyRequired, setPuttyRequired] = useState<"" | "YES" | "NO">("");
  const [pestPropertySize, setPestPropertySize] = useState("");
  const [housekeepingStaffCount, setHousekeepingStaffCount] = useState("");
  const [housekeepingShiftHours, setHousekeepingShiftHours] = useState("");

  // Customizer Package (CUSTOMIZER_PACKAGE) — generic Quantity/Unit Price
  // pair used by every variant that isn't Sofa/Mattress (which reuse the
  // size-based state above).
  const [czQty, setCzQty] = useState("");
  const [czUnitPrice, setCzUnitPrice] = useState("");

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
      if (variant === "Sofa Cleaning" && sofaSeater) return SOFA_SEATER_PRICES[sofaSeater] ?? 0;
      if (variant === "Mattress Cleaning" && mattressSize) {
        const qty = Number(mattressQty) || 1;
        return (MATTRESS_UNIT_PRICE[mattressSize] ?? 0) * qty;
      }
      const fixedRate = variant ? CUSTOMIZER_FIXED_UNIT_PRICE[variant] : undefined;
      if (fixedRate) {
        const qty = Number(czQty) || 1;
        return fixedRate * qty;
      }
      // No configured rate for this item (e.g. Balcony/Kitchen/Chimney/Fan/
      // Floor Cleaning) — only use what staff typed in Unit Price, never a
      // guessed number.
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
    // Customizer Package — a priced line (rate known, folded into Estimated
    // Amount above) is recorded plainly; an unpriced one (no configured rate
    // and no unit price typed yet) gets the distinct "(price to be
    // confirmed)" marker so quotation generation lists it as a $0 line
    // instead of double-counting it (see src/lib/ai/quotation.ts /
    // quotation-dialog.tsx).
    if (category === "CUSTOMIZER_PACKAGE" && variant) {
      if (variant === "Sofa Cleaning" && sofaSeater) {
        const amt = SOFA_SEATER_PRICES[sofaSeater] ?? 0;
        lines.push(`Customizer Package — Sofa Cleaning: ${sofaSeater} = ₹${amt}`);
      } else if (variant === "Mattress Cleaning" && mattressSize) {
        const qty = Number(mattressQty) || 1;
        const amt = (MATTRESS_UNIT_PRICE[mattressSize] ?? 0) * qty;
        lines.push(`Customizer Package — Mattress Cleaning: ${mattressSize} x ${qty} = ₹${amt}`);
      } else if (variant !== "Sofa Cleaning" && variant !== "Mattress Cleaning" && czQty) {
        const qty = Number(czQty) || 0;
        const fixedRate = CUSTOMIZER_FIXED_UNIT_PRICE[variant];
        const rate = fixedRate ?? (Number(czUnitPrice) || 0);
        if (qty > 0 && rate > 0) {
          lines.push(`Customizer Package — ${variant}: Qty ${qty} × ₹${rate} = ₹${qty * rate}`);
        } else if (qty > 0) {
          lines.push(`Customizer Package (price to be confirmed) — ${variant}: Qty ${qty}`);
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

      {category === "CUSTOMIZER_PACKAGE" && variant === "Sofa Cleaning" && (
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
      {category === "CUSTOMIZER_PACKAGE" && variant === "Mattress Cleaning" && (
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
          <QtyStepper label="Number of Mattresses" value={mattressQty} onChange={setMattressQty} min={1} />
        </div>
      )}
      {category === "CUSTOMIZER_PACKAGE" && variant && variant !== "Sofa Cleaning" && variant !== "Mattress Cleaning" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <QtyStepper label="Quantity" value={czQty} onChange={setCzQty} min={1} />
          {CUSTOMIZER_FIXED_UNIT_PRICE[variant] ? (
            <div className={fieldWrap}>
              <Label>Unit Price (₹)</Label>
              <Input value={formatINR(CUSTOMIZER_FIXED_UNIT_PRICE[variant])} disabled readOnly />
            </div>
          ) : (
            <div className={fieldWrap}>
              <Label>Unit Price (₹)</Label>
              <Input
                inputMode="numeric"
                value={czUnitPrice}
                onChange={(e) => setCzUnitPrice(e.target.value.replace(/\D/g, ""))}
                placeholder="No configured rate — enter the quoted price"
              />
            </div>
          )}
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

      {estimate > 0 && (
        <p className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground">
          Estimated from selections: <span className="font-bold">{formatINR(estimate)}</span> — filled into Estimated Amount above, you can edit it.
        </p>
      )}
    </div>
  );
}
