"use client";

import { getAttributionPayload } from "@/components/public/attribution-capture";
import { trackLead } from "@/components/public/marketing-tags";
import { useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  User,
  Phone,
  MapPin,
  Sparkles,
  CalendarDays,
  CreditCard,
  Lock,
  Sofa,
  BedDouble,
  Refrigerator,
  Bug,
  Layers,
  AppWindow,
  Bath,
  DoorOpen,
  CookingPot,
  Flame,
  Fan,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapsLocationInput, type MapsLocationValue } from "@/components/shared/maps-location-input";
import { type CompanyPaymentDetails } from "@/components/shared/payment-details-box";
import {
  TIME_SLOTS,
  ADDON_SERVICE_PRICES,
  propertyTypesFor,
  SERVICE_CATALOG,
  SERVICE_RULES,
  CATEGORIES,
  SOFA_SEATER_OPTIONS,
  SOFA_SEATER_PRICES,
  MATTRESS_SIZE_OPTIONS,
  MATTRESS_UNIT_PRICE,
  HOME_SERVICE_UNIT_PRICE,
  PAINT_TYPE_RATE_PER_SQFT,
  PEST_PROPERTY_SIZE_OPTIONS,
  PEST_PROPERTY_SIZE_PRICES,
  HOUSEKEEPING_SHIFT_HOURS,
  HOUSEKEEPING_HOURLY_RATE,
  HEAR_ABOUT_US_OPTIONS,
  PUBLIC_HOME_CLEANING_SERVICE_TYPES,
  HOME_CLEANING_PACKAGES,
  PUBLIC_PAINT_TYPES,
  PAINTING_REQUIREMENT_OPTIONS,
} from "@/lib/constants";
import { publicBookLead } from "@/server/actions/public-booking";
import { getSlotAvailability } from "@/server/actions/slot-availability";

// The four customer-facing categories shown on the public booking page are
// defined in src/lib/constants.ts (exported as CATEGORIES) and re-exported
// here so existing call sites that import CATEGORIES from this module keep
// working. Moved out of this "use client" file because the Server Component
// landing page (src/app/book/page.tsx) reads CATEGORIES during SSR — a plain
// constant imported from a "use client" module resolves to a client-reference
// proxy on the server rather than the real array, which crashed production
// with "TypeError: CATEGORIES.some is not a function".
export { CATEGORIES };

const SERVICE_TYPE_HINT: Record<string, string> = {
  CUSTOMIZER_PACKAGE: "Pick the exact service you need — combine as many as you like.",
  COMBO_PACKAGE: "Bundled services at a package price — final amount confirmed after a quick quotation.",
};

const ADDON_ICONS: Record<string, typeof Sofa> = {
  "Sofa Shampooing": Sofa,
  "Mattress Cleaning": BedDouble,
  "Refrigerator Cleaning": Refrigerator,
  "Pest Control": Bug,
};

// Customized Service — one icon per selectable service card (no photos
// needed; icons keep the page fast and consistent with the add-on cards
// above). Falls back to Sparkles for any future service added to
// SERVICE_CATALOG.CUSTOMIZER_PACKAGE that isn't listed here yet.
const CUSTOMIZED_SERVICE_ICONS: Record<string, typeof Sofa> = {
  "Sofa Cleaning": Sofa,
  "Carpet Cleaning": Layers,
  "Window Cleaning": AppWindow,
  "Mattress Cleaning": BedDouble,
  "Bathroom Cleaning": Bath,
  "Balcony Cleaning": DoorOpen,
  "Kitchen Cleaning": CookingPot,
  "Chimney Cleaning": Flame,
  "Refrigerator Cleaning": Refrigerator,
  "Fan Cleaning": Fan,
  "Floor Cleaning": LayoutGrid,
};

// Simple +/- quantity field shared by the Booking Form V2 dynamic
// sub-fields (Bathrooms, Kitchens, Carpets, Windows, Curtain pairs, Rooms,
// Staff Count, etc). Defined at module scope (not inside the form
// component) so it keeps a stable identity across re-renders.
function QtyStepper({
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
          onClick={() => onChange(String((num || min - 1) + 1))}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-lg font-semibold text-foreground active:scale-95"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function PublicBookingForm({
  referralCode,
  mapsApiKey = null,
  leadSource = "",
  paymentDetails,
  prefillName = "",
  prefillMobile = "",
  bookingLinkToken = "",
  initialCategory = "",
}: {
  referralCode?: string;
  mapsApiKey?: string | null;
  leadSource?: string;
  paymentDetails: CompanyPaymentDetails;
  prefillName?: string;
  prefillMobile?: string;
  bookingLinkToken?: string;
  /** Pre-selects Service Category, e.g. from a "Book Now" card on the landing
   * page above (?category=HOME_DEEP_CLEANING). Purely an initial value —
   * the customer can still change it, and every other field/behaviour below
   * is unchanged. */
  initialCategory?: string;
}) {
  const [name, setName] = useState(prefillName);
  const [mobile, setMobile] = useState(prefillMobile);
  const [alternateMobile, setAlternateMobile] = useState("");
  const [address, setAddress] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [category, setCategory] = useState(initialCategory || "");
  const [variant, setVariant] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [addOns, setAddOns] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loc, setLoc] = useState<MapsLocationValue>({ mapLink: "", lat: null, lng: null });
  // Default is "Pay After Service" (LATER) per the 2026-09-22 booking-form
  // master prompt — was ADVANCE before. Amounts are never shown/collected
  // publicly any more (see the Payment Option section below); this choice
  // is now purely a stated preference the office follows up on.
  const [payChoice, setPayChoice] = useState<"ADVANCE" | "LATER">("LATER");
  // Kept internal-only (never rendered) so the existing suggested-estimate
  // calculation below can still silently reach the CRM as estimatedAmount —
  // "backend calculations can remain intact... don't delete logic merely
  // because the frontend no longer displays it."
  const [estimated, setEstimated] = useState("");
  const [estimatedTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ leadNumber: string; advancePaid: boolean } | null>(null);

  // Booking Form V2 — optional lead-source field.
  const [hearAboutUs, setHearAboutUs] = useState("");

  // Booking Form V2 — dynamic service sub-fields.
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
  const [pestPropertySize, setPestPropertySize] = useState("");
  const [housekeepingStaffCount, setHousekeepingStaffCount] = useState("");
  const [housekeepingShiftHours, setHousekeepingShiftHours] = useState("");

  // Home Cleaning — Package tier, shown only for "Full Home Cleaning"
  // (2026-09-22 master prompt). Kept separate from Service Type itself.
  const [packageName, setPackageName] = useState("");

  // Interior Painting — replaces the removed "Putty Required?" field.
  const [paintingRequirement, setPaintingRequirement] = useState("");

  // Customized Service — TRUE multi-select (2026-09-22 master prompt):
  // every selected service keeps its own independent quantity in one map,
  // keyed by service name. Selecting/changing one entry never touches any
  // other — no unit price or rate is ever shown or collected here, pricing
  // stays an internal CRM concept (see service-quantity-fields.tsx for the
  // staff-facing Quantity/Unit Price/Estimated Amount engine).
  const [customizedServices, setCustomizedServices] = useState<Record<string, number>>({});

  function toggleCustomizedService(serviceName: string) {
    setCustomizedServices((prev) => {
      if (serviceName in prev) {
        const next = { ...prev };
        delete next[serviceName];
        return next;
      }
      return { ...prev, [serviceName]: serviceName === "Sofa Cleaning" ? 5 : 1 };
    });
  }

  function setCustomizedQty(serviceName: string, qty: string) {
    const n = Math.max(1, Number(qty) || 1);
    setCustomizedServices((prev) => (serviceName in prev ? { ...prev, [serviceName]: n } : prev));
  }

  // Smart Calendar — real (never fabricated) slot-availability estimate for
  // the selected date. "Not a final confirmation" — the office team always
  // verifies before a slot is locked in.
  const [slotInfo, setSlotInfo] = useState<{ label: string; isFull: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!serviceDate) {
      setSlotInfo(null);
      return;
    }
    getSlotAvailability(serviceDate).then((res) => {
      if (!cancelled && res.ok) setSlotInfo({ label: res.label, isFull: res.isFull });
    }).catch(() => {
      if (!cancelled) setSlotInfo(null);
    });
    return () => {
      cancelled = true;
    };
  }, [serviceDate]);

  const estNum = Number(estimated) || 0;
  // Home Cleaning and Painting show a public-only Service Type list here
  // (2026-09-22 master prompt) — SERVICE_CATALOG itself is untouched and
  // still serves the internal CRM's own dropdown for these two categories.
  const serviceOptions: readonly string[] =
    category === "HOME_DEEP_CLEANING"
      ? PUBLIC_HOME_CLEANING_SERVICE_TYPES
      : category === "PAINTING"
        ? PUBLIC_PAINT_TYPES
        : category
          ? SERVICE_CATALOG[category] ?? []
          : [];
  const serviceRule = variant ? SERVICE_RULES[variant] : "";
  // Customizer Package and Combo Package are picked by item/bundle, not by
  // BHK/property size — Property Type doesn't apply to them. Full Home
  // Cleaning and Commercial Cleaning are untouched: they keep Property Type
  // where it's shown today.
  const usesServiceTypeAsSecondary = category === "CUSTOMIZER_PACKAGE" || category === "COMBO_PACKAGE";
  // Customized Service picks its Service Type from the visual card grid
  // below instead of a dropdown — see CUSTOMIZED_SERVICE_ICONS.
  const isCustomizedService = category === "CUSTOMIZER_PACKAGE";

  function handleVariantChange(v: string) {
    setVariant(v);
    // Reset sub-fields that belong to a different service so stale
    // selections never linger (and never leak into notes/pricing).
    setSofaSeater("");
    setBathroomQty("");
    setKitchenQty("");
    setCarpetQty("");
    setWindowQty("");
    setMattressSize("");
    setMattressQty("");
    setCurtainQty("");
    setPackageName("");
  }

  // Live indicative price from the dynamic sub-field selections — recomputed
  // on every render so it updates instantly as the customer picks options.
  function computeSuggestedEstimate(): number {
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
      // Kept internal-only. "Putty Required?" was removed from the public
      // form (2026-09-22 master prompt) along with its rate addition; paint
      // type names shown publicly (PUBLIC_PAINT_TYPES) also no longer match
      // PAINT_TYPE_RATE_PER_SQFT's CRM-only keys, so this silently
      // evaluates to 0 for painting now — never shown either way.
      const sqft = Number(paintSqft) || 0;
      const rate = variant ? PAINT_TYPE_RATE_PER_SQFT[variant] ?? 0 : 0;
      if (sqft > 0 && rate > 0) return Math.round(sqft * rate);
    }
    if (category === "PEST_CONTROL" && pestPropertySize) {
      return PEST_PROPERTY_SIZE_PRICES[pestPropertySize] ?? 0;
    }
    if (category === "HOUSEKEEPING" && housekeepingShiftHours && housekeepingStaffCount) {
      const hours = parseInt(housekeepingShiftHours, 10) || 0;
      const staff = Number(housekeepingStaffCount) || 1;
      return Math.round(hours * staff * HOUSEKEEPING_HOURLY_RATE);
    }
    // Customized Service deliberately never computes or reveals a
    // suggested amount to the customer — pricing for these items is an
    // internal, staff-only concept (Quantity x Unit Price in the CRM Lead
    // form). The customer only picks the service and quantity here; the
    // office confirms the real price by quotation/call.
    return 0;
  }

  const suggestedEstimate = computeSuggestedEstimate();

  // Auto-fill the Estimated field the instant a sub-field selection produces
  // a price — but only while the customer hasn't typed their own number in
  // that field, so we never silently overwrite a manually entered estimate.
  useEffect(() => {
    if (!estimatedTouched && suggestedEstimate > 0) {
      setEstimated(String(suggestedEstimate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedEstimate, estimatedTouched]);

  function toggleAddOn(n: string) {
    setAddOns((prev) => (prev.includes(n) ? prev.filter((a) => a !== n) : [...prev, n]));
  }

  // Compose the dynamic sub-field selections + optional lead-source answer
  // into a readable notes block. No schema changes needed — Lead.notes is
  // already a free-text field fully wired through to the CRM timeline.
  function buildSelectionNotes(): string {
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
    if (category === "HOME_DEEP_CLEANING" && variant === "Full Home Cleaning" && packageName) {
      lines.push(`Package: ${packageName}`);
    }
    if (category === "PAINTING") {
      if (paintingRequirement) lines.push(`Painting Requirement: ${paintingRequirement}`);
      if (paintRooms) lines.push(`Rooms: ${paintRooms}`);
      if (paintSqft) lines.push(`Area: ${paintSqft} sq ft`);
    }
    if (category === "PEST_CONTROL" && pestPropertySize) lines.push(`Property Size: ${pestPropertySize}`);
    if (category === "HOUSEKEEPING") {
      if (housekeepingStaffCount) lines.push(`Staff Count: ${housekeepingStaffCount}`);
      if (housekeepingShiftHours) lines.push(`Shift Hours: ${housekeepingShiftHours}`);
    }
    // Customized Service — TRUE multi-select: every selected service keeps
    // its own independent quantity, and all of them (not just one) must
    // reach the CRM Lead. Quantity/size only, never a price: the office
    // prices these manually in the CRM Lead form once the enquiry comes in.
    if (category === "CUSTOMIZER_PACKAGE") {
      for (const [serviceName, qty] of Object.entries(customizedServices)) {
        lines.push(`Customized Service — ${serviceName}: Qty ${qty}`);
      }
    }
    if (hearAboutUs) lines.push(`Heard about Sahara via: ${hearAboutUs}`);
    return lines.join("\n");
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // Quick-booking philosophy (2026-09-22 master prompt): only Name, Mobile,
    // Address, Date and Time are truly required. Service Category still
    // needs a value since the form is always reached from a category context
    // and the server schema requires it, but a specific Service Type is no
    // longer required to submit.
    if (!category) {
      setError("Please choose a service category.");
      return;
    }
    const advancePaid = payChoice === "ADVANCE";
    const selectionNotes = buildSelectionNotes();
    const combinedNotes = [notes.trim(), selectionNotes].filter(Boolean).join("\n\n");
    setSubmitting(true);
    const res = await publicBookLead({
      name,
      mobile,
      alternateMobile,
      email: "",
      address,
      pinCode: "",
      serviceCategory: category,
      serviceVariant: variant,
      propertyType,
      packageName,
      comboServices: [],
      addOnServices: addOns,
      serviceDate,
      timeSlot,
      notes: combinedNotes,
      mapLink: loc.mapLink,
      website: "",
      source: leadSource,
      referralCode: referralCode || "",
      bookingLinkToken: bookingLinkToken || "",
      estimatedAmount: estNum || undefined,
      advancePaid,
      attribution: getAttributionPayload(),
    });
    setSubmitting(false);
    if ("error" in res) {
      setError(res.error ?? "Something went wrong");
      return;
    }
    // Meta Pixel readiness (Phase 6, 2026-09-21): fires only if the Pixel
    // script actually loaded (see app/book/page.tsx — gated on
    // NEXT_PUBLIC_META_PIXEL_ID), a no-op otherwise. This is the
    // client-side half of ad-conversion tracking; the server-side
    // Conversion API half needs a Pixel access token the owner adds once
    // Meta Business Manager access is set up — see
    // SAHARA_OS_META_READINESS.md.
    if (typeof window !== "undefined" && typeof (window as { fbq?: (...args: unknown[]) => void }).fbq === "function") {
      (window as unknown as { fbq: (...args: unknown[]) => void }).fbq("track", "Lead", {
        content_name: variant,
        content_category: category,
      });
    }
    trackLead({ category, variant });
    setDone({ leadNumber: res.leadNumber, advancePaid });
  }

  if (done) {
    const row = (label: string, value: string) => (
      <div className="flex justify-between gap-3 py-0.5">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="text-right font-medium text-foreground">{value}</dd>
      </div>
    );
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <CheckCircle2 className="size-12 text-success" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Booking request received!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Our team will confirm within 5–15 minutes with a WhatsApp message on {mobile || "your number"}.
          </p>
        </div>
        <dl className="w-full space-y-0.5 rounded-xl border border-border bg-muted/30 p-4 text-left text-sm">
          {row("Booking ID", done.leadNumber)}
          {row("Customer", name)}
          {row("Service", variant || "—")}
          {propertyType ? row("Property Type", propertyType) : null}
          {serviceDate ? row("Preferred date", serviceDate) : null}
          {timeSlot ? row("Preferred time", timeSlot) : null}
          {addOns.length ? row("Add-ons", addOns.join(", ")) : null}
          {row("Payment Option", done.advancePaid ? "Pay Advance" : "Pay After Service")}
        </dl>
        <div className="flex w-full flex-col gap-2">
          <a
            href={`https://wa.me/918956567130?text=${encodeURIComponent(`Hi, I just booked online. My booking ID is ${done.leadNumber}.`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-sm font-semibold text-white"
          >
            <Phone className="size-4" /> Message us on WhatsApp
          </a>
          <a
            href="tel:+917083347130"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary px-4 py-3 text-sm font-semibold text-primary"
          >
            <Phone className="size-4" /> Call 7083347130
          </a>
        </div>
      </div>
    );
  }

  const fieldWrap = "space-y-1.5";
  const iconInput = "relative";
  const iconEl = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground";

  return (
    <form onSubmit={submitBooking} className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">Book Your Cleaning Service</h2>
          <p className="text-sm text-muted-foreground">Get a cleaner, healthier and happier space in just a few clicks.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={fieldWrap}>
          <Label htmlFor="pb-name">Full Name <span className="text-destructive">*</span></Label>
          <div className={iconInput}>
            <User className={`${iconEl} size-4`} />
            <Input id="pb-name" className="pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" required />
          </div>
        </div>
        <div className={fieldWrap}>
          <Label htmlFor="pb-mobile">Mobile Number <span className="text-destructive">*</span></Label>
          <div className={iconInput}>
            <Phone className={`${iconEl} size-4`} />
            <Input id="pb-mobile" className="pl-9" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Enter mobile number" required />
          </div>
        </div>
      </div>

      <div className={fieldWrap}>
        <Label htmlFor="pb-alt-mobile">Alternative Mobile Number <span className="font-normal text-muted-foreground">(Optional)</span></Label>
        <div className={iconInput}>
          <Phone className={`${iconEl} size-4`} />
          <Input
            id="pb-alt-mobile"
            className="pl-9"
            inputMode="tel"
            value={alternateMobile}
            onChange={(e) => setAlternateMobile(e.target.value)}
            placeholder="Enter alternative number"
          />
        </div>
      </div>

      <div className={fieldWrap}>
        <Label htmlFor="pb-address">Address <span className="text-destructive">*</span></Label>
        <div className={iconInput}>
          <MapPin className={`${iconEl} size-4`} />
          <Textarea id="pb-address" className="pl-9" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Enter complete address" required />
        </div>
        <p className="text-xs text-muted-foreground">We will use this to provide accurate service.</p>
        <MapsLocationInput value={loc} onChange={setLoc} apiKey={mapsApiKey} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={fieldWrap}>
          <Label>Service Category <span className="text-destructive">*</span></Label>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setVariant("");
              setPropertyType("");
            }}
          >
            <SelectTrigger><SelectValue placeholder="Select Service Category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className={fieldWrap}>
          {isCustomizedService ? (
            <>
              <Label>Service</Label>
              <p className="flex h-9 items-center text-sm text-muted-foreground">
                {variant || "Pick a service card below ↓"}
              </p>
            </>
          ) : usesServiceTypeAsSecondary ? (
            <>
              <Label>Service Type <span className="text-destructive">*</span></Label>
              <Select value={variant} onValueChange={handleVariantChange} disabled={!category}>
                <SelectTrigger><SelectValue placeholder={category ? "Select Service Type" : "Pick a category first"} /></SelectTrigger>
                <SelectContent>
                  {serviceOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              {SERVICE_TYPE_HINT[category] && <p className="text-xs text-muted-foreground">{SERVICE_TYPE_HINT[category]}</p>}
              {serviceRule && <p className="text-xs font-medium text-primary">{serviceRule}</p>}
            </>
          ) : (
            <>
              <Label>Property Type <span className="text-destructive">*</span></Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger><SelectValue placeholder="Select Property Type" /></SelectTrigger>
                <SelectContent>
                  {propertyTypesFor(category).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      {isCustomizedService && (
        <div className={fieldWrap}>
          <Label>Choose Services <span className="text-destructive">*</span></Label>
          <p className="text-xs text-muted-foreground">Select multiple services as per your requirement.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {serviceOptions.map((o) => {
              const Icon = CUSTOMIZED_SERVICE_ICONS[o] ?? Sparkles;
              const selected = o in customizedServices;
              return (
                <div
                  key={o}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${
                    selected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <button type="button" onClick={() => toggleCustomizedService(o)} className="flex flex-col items-center gap-2">
                    <Icon className={`size-6 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs font-medium text-foreground">{o}</span>
                  </button>
                  {selected && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        aria-label={`Decrease ${o} quantity`}
                        onClick={() => setCustomizedQty(o, String(customizedServices[o] - 1))}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border text-sm font-semibold text-foreground active:scale-95"
                      >
                        −
                      </button>
                      <Input
                        inputMode="numeric"
                        className="h-6 w-10 px-1 text-center text-xs"
                        value={String(customizedServices[o])}
                        onChange={(e) => setCustomizedQty(o, e.target.value.replace(/\D/g, ""))}
                      />
                      <button
                        type="button"
                        aria-label={`Increase ${o} quantity`}
                        onClick={() => setCustomizedQty(o, String(customizedServices[o] + 1))}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border text-sm font-semibold text-foreground active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!usesServiceTypeAsSecondary && (
        <div className={fieldWrap}>
          <Label>Service Type <span className="text-destructive">*</span></Label>
          <Select value={variant} onValueChange={handleVariantChange} disabled={!category}>
            <SelectTrigger><SelectValue placeholder={category ? "Select Service Type" : "Pick a category first"} /></SelectTrigger>
            <SelectContent>
              {serviceOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          {SERVICE_TYPE_HINT[category] && <p className="text-xs text-muted-foreground">{SERVICE_TYPE_HINT[category]}</p>}
          {serviceRule && <p className="text-xs font-medium text-primary">{serviceRule}</p>}
        </div>
      )}

      {category === "HOME_DEEP_CLEANING" && variant === "Full Home Cleaning" && (
        <div className={fieldWrap}>
          <Label>Package</Label>
          <Select value={packageName} onValueChange={setPackageName}>
            <SelectTrigger><SelectValue placeholder="Select a package (optional)" /></SelectTrigger>
            <SelectContent>
              {HOME_CLEANING_PACKAGES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {category === "PAINTING" && (
        <div className={fieldWrap}>
          <Label>Painting Requirement</Label>
          <div className="flex gap-2">
            {PAINTING_REQUIREMENT_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => setPaintingRequirement(opt)}
                className={`rounded-lg border px-4 py-2 text-xs font-semibold ${
                  paintingRequirement === opt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={fieldWrap}>
          <Label htmlFor="pb-date">Preferred Date <span className="text-destructive">*</span></Label>
          <div className={iconInput}>
            <CalendarDays className={`${iconEl} size-4`} />
            <DateInput id="pb-date" className="pl-9" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} required />
          </div>
          {slotInfo && (
            <p className={`text-xs font-medium ${slotInfo.isFull ? "text-destructive" : "text-success"}`}>
              {slotInfo.label} <span className="font-normal text-muted-foreground">(estimated — not a final confirmation)</span>
            </p>
          )}
        </div>
        <div className={fieldWrap}>
          <Label>Preferred Time <span className="text-destructive">*</span></Label>
          <Select value={timeSlot} onValueChange={setTimeSlot}>
            <SelectTrigger><SelectValue placeholder="Select Time" /></SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Dynamic service sub-fields (Booking Form V2) ─────────────── */}
      {category === "HOME_DEEP_CLEANING" && variant === "Sofa Cleaning" && (
        <div className={fieldWrap}>
          <Label>Sofa Size <span className="text-destructive">*</span></Label>
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
            <Label>Mattress Size <span className="text-destructive">*</span></Label>
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

      {/* "Putty Required?" removed completely from the public form
          (2026-09-22 master prompt) — Painting Requirement (New/Repainting)
          is asked separately above, before Date/Time. These two detail
          fields stay optional and never block a quick booking. */}
      {category === "PAINTING" && (
        <div className="space-y-4 rounded-xl border border-border p-3.5">
          <p className="text-sm font-semibold text-foreground">Painting Details <span className="font-normal text-muted-foreground">(Optional)</span></p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <QtyStepper label="Number of Rooms" value={paintRooms} onChange={setPaintRooms} min={1} />
            <div className={fieldWrap}>
              <Label>Square Feet (approx.)</Label>
              <Input inputMode="numeric" value={paintSqft} onChange={(e) => setPaintSqft(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 1200" />
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border border-border p-3.5">
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

      {/* Customized Service quantities are now entered directly on each
          service card above (true multi-select — see the "Choose Services"
          block near the top of the form), so there's no separate
          single-variant quantity field here any more. */}

      {/* Section 12 (2026-09-22 master prompt): the booking form must never
          show a computed/estimated amount to the customer. suggestedEstimate
          is still computed above and silently submitted as estimatedAmount
          for staff/CRM use — it's just never rendered here any more. */}

      {/* Add-on services */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-primary text-white">
            <CheckCircle2 className="size-3.5" />
          </span>
          <p className="text-sm font-semibold text-foreground">Add-on Services <span className="font-normal text-muted-foreground">(Optional)</span></p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {ADDON_SERVICE_PRICES.map(({ name: svc, price }) => {
            const Icon = ADDON_ICONS[svc] ?? Sparkles;
            const on = addOns.includes(svc);
            return (
              <button
                type="button"
                key={svc}
                onClick={() => toggleAddOn(svc)}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                  on ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/40"
                }`}
              >
                <Icon className={`size-5 ${on ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium text-foreground">{svc}</span>
                <span className="text-[11px] text-muted-foreground">{price}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment option */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Payment Option <span className="text-destructive">*</span></p>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border">
          <label className="flex cursor-pointer items-start gap-3 p-3.5">
            <input type="radio" name="pay" className="mt-1 accent-primary" checked={payChoice === "LATER"} onChange={() => setPayChoice("LATER")} />
            <span>
              <span className="block text-sm font-semibold text-foreground">Pay After Service</span>
              <span className="block text-xs text-muted-foreground">Book now and pay after the service is completed.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 p-3.5">
            <input type="radio" name="pay" className="mt-1 accent-primary" checked={payChoice === "ADVANCE"} onChange={() => setPayChoice("ADVANCE")} />
            <span>
              <span className="block text-sm font-semibold text-foreground">Pay Advance <span className="font-normal text-muted-foreground">(Secure &amp; Confirm Booking)</span></span>
              <span className="block text-xs text-muted-foreground">Our team will share payment details on WhatsApp to confirm your booking.</span>
            </span>
          </label>
        </div>
      </div>

      <div className={fieldWrap}>
        <Label>How did you hear about Sahara? <span className="font-normal text-muted-foreground">(Optional)</span></Label>
        <Select value={hearAboutUs} onValueChange={setHearAboutUs}>
          <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
          <SelectContent>
            {HEAR_ABOUT_US_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pb-notes">Notes (optional)</Label>
        <Textarea id="pb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Parking, lift, pets, urgent requirement…" />
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <Button type="submit" size="lg" disabled={submitting}
        className="h-12 w-full rounded-xl bg-success text-base font-semibold text-white hover:bg-success/90">
        {submitting ? <Loader2 className="animate-spin" /> : <Phone className="size-4" />}
        Confirm &amp; Book Now
        <span aria-hidden>›</span>
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Lock className="size-3.5" /> Your information is 100% secure with us.
      </p>
    </form>
  );
}
