"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Building2, Bug, Check, CheckCircle2, ChevronDown, Clock, Home, Loader2, LocateFixed, Paintbrush, Wallet, X } from "lucide-react";
import { publicBookLead } from "@/server/actions/public-booking";
import { getDateAvailability, getSlotAvailability } from "@/server/actions/slot-availability";
import type { DayStatus } from "@/server/slot-capacity";
import { getAttributionPayload } from "@/components/public/attribution-capture";
import { PaymentDetailsBox, type CompanyPaymentDetails } from "@/components/shared/payment-details-box";
import { advanceBreakdown, ADVANCE_PERCENT } from "@/lib/booking-payment";
import { trackFunnel, trackLead } from "@/components/public/marketing-tags";
import { inr, EQUIPMENT, OFFICE_SCOPE, PAINT_SCOPE, PEST_SERVICES, TERMS } from "@/lib/marketing-content";
import { CUSTOMER_REQUIREMENTS, HOME_DURATION, homeHighlights, homePleaseNote, homeScopeByArea, smallServiceNotes, type HomeTier } from "@/lib/service-scope";
import { BOOKING_TERMS, INSPECTION_NOTE, PRICING_MASTER, activeCampaign, festivalForDate, inGroup, maskPaintingPrices, needsInspection, priceLabel, unitPriceFor, upcomingFestivals, type LivePricing, type PriceItem, type PriceType } from "@/lib/pricing-master";

// Shown once, right under the service prices.
const PRICE_NOTE =
  "Standard prices shown. Final price may vary based on your requirements, service scope, location and applicable demand/season. Final price will be confirmed before booking.";

// Customer booking flow (approved transparent-pricing design). Every price
// comes from the Sahara pricing master — never the legacy CRM estimate
// tables — and there is no minimum booking value. Submitting creates a
// BOOKING REQUEST; the office confirms it in the CRM.

export type QuotePrefill = {
  token: string;
  quoteNumber: string;
  customerName: string;
  mobile: string;
  services: string[];
  totalAmount: number;
};

type Category = "HOME" | "COMMERCIAL" | "PEST" | "PAINTING";
type Line = { label: string; amount: number | null; note?: string };

// Owner 2026-10-05: Property Type + 4 packages. Fixed prices exist only for
// 1–4 BHK × Premium / Platinum; every other combination is "price on confirmation".
const BHKS = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK", "Villa", "Bungalow", "Commercial/Office", "Other"];
const HOME_PACKAGES = ["Premium", "Platinum", "Diamond", "Unfurnished"] as const;
const isTier = (v: string): v is HomeTier => v === "Premium" || v === "Platinum";
const PEST_SIZES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK+", "Villa / Bungalow", "Commercial"];
const PAINT_PROPERTIES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK+", "Villa / Bungalow", "Office / Shop"];
const PAINT_JOBS = ["Fresh Painting", "Repainting"];
const COM_FREQUENCY = ["One-time", "Weekly", "Monthly", "Annual contract"];
// Painting scope, step by step — every line restates the approved PAINT_SCOPE
// (marketing-content.ts); nothing here adds an inclusion beyond it.
const PAINT_SCOPE_STEPS: [string, string][] = [
  ["Site visit & measurement", PAINT_SCOPE[0]],
  ["Surface preparation", "Cleaning and sanding of the surface where applicable."],
  ["Minor crack repair", "Minor crack filling where applicable."],
  ["Putty / primer", "Putty and sanding where included; primer where applicable."],
  ["Coats", "Number of coats as per site condition and the selected finish."],
  ["Masking / covering", "Basic furniture and floor protection."],
  ["Application & finishing", "Paint application with edge / corner finishing."],
  ["Post-paint cleaning", "Final cleaning of the painted area."],
];

/** Mobile-only one-line summary of a completed step, with a Change link. */
function MobileSummaryRow({ label, onChange, children }: { label: string; onChange: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-white px-3 py-2 text-sm shadow-sm sm:hidden">
      <Check className="size-4 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#0a2540]/50">{label}</p>
        <p className="truncate font-semibold">{children}</p>
      </div>
      <button type="button" onClick={onChange} className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-bold text-primary">Change</button>
    </div>
  );
}

/** Inline validation hint under a field. */
function FieldHint({ show, children }: { show: boolean; children: React.ReactNode }) {
  return show ? <p className="mt-1 text-xs font-medium text-red-600">{children}</p> : null;
}

/** Compact expandable detail block — keeps long scope text off the main screen. */
function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-[#0a2540]/10 bg-white">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-semibold">
        {title}
        <ChevronDown className="size-4 transition group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3 text-[13px]">{children}</div>
    </details>
  );
}
const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const shortDay = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

const card = "rounded-2xl bg-white p-3 shadow-sm sm:p-5";
const input = "h-12 w-full rounded-xl border border-[#0a2540]/15 bg-white px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:h-11 sm:text-sm";
const chip = (on: boolean) =>
  `min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition active:scale-[0.98] ${on ? "border-primary bg-primary text-white" : "border-[#0a2540]/15 bg-white hover:border-primary/50"}`;
const fmtDay = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function Stepper({ value, min, onChange }: { value: number; min: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Decrease" onClick={() => onChange(value <= min ? 0 : value - 1)} className="size-10 rounded-full border border-[#0a2540]/20 text-lg font-bold active:bg-primary/10">−</button>
      <span className="w-7 text-center font-bold">{value}</span>
      <button type="button" aria-label="Increase" onClick={() => onChange(value === 0 ? min : value + 1)} className="size-10 rounded-full border border-primary/40 text-lg font-bold text-primary active:bg-primary/10">+</button>
    </div>
  );
}

export function BookingWizard({
  quote,
  defaultCategory,
  hidePicker,
  campaignName,
  referralCode,
  prefill,
  preset,
  pricing,
  paymentDetails,
}: {
  quote?: QuotePrefill | null;
  defaultCategory?: Category;
  /** /booking: the four service cards above pick the service, so this form shows only the chosen service's options (no second picker list). */
  hidePicker?: boolean;
  /** Package pages open with the full-house package already chosen. */
  preset?: { bhk: string; pkg: HomeTier };
  campaignName?: string;
  referralCode?: string;
  prefill?: { name?: string; mobile?: string };
  /** Live prices + festival offers (server/pricing.ts). Falls back to the catalogue. */
  pricing?: LivePricing;
  /** Company UPI QR + bank details (CRM Settings) shown on the confirmation for the advance. */
  paymentDetails?: CompanyPaymentDetails | null;
}) {
  // Live catalogue (Super Admin → Pricing & Packages). Interior-painting rates are never shown or used
  // here (owner decision): painting is quoted after a free site inspection.
  const items = useMemo(() => maskPaintingPrices(pricing?.items ?? PRICING_MASTER), [pricing]);
  const { CUSTOMISED, ADDON_ITEMS, COMBOS, ADDON_COMBOS, PACKAGE_COMBOS, PAINTS, PUTTY, PEST_ITEMS, COMMERCIAL_ITEMS } = useMemo(() => {
    const combos = inGroup(items, "COMBO");
    const customised = inGroup(items, "CUSTOMISED");
    return {
      CUSTOMISED: customised,
      // Add-ons offered on a full-home package — kitchen and bathrooms are already in the package.
      ADDON_ITEMS: customised.filter((it) => it.variant !== "Kitchen Deep Cleaning" && it.variant !== "Bathroom Cleaning"),
      COMBOS: combos,
      ADDON_COMBOS: combos.filter((c) => c.addOnOnly),
      PACKAGE_COMBOS: combos.filter((c) => !c.addOnOnly),
      PAINTS: inGroup(items, "PAINTING").filter((p) => !p.addOnOnly),
      PUTTY: items.find((p) => p.contentId === "SCS-PUTTY") ?? null,
      PEST_ITEMS: inGroup(items, "PEST"),
      COMMERCIAL_ITEMS: inGroup(items, "COMMERCIAL"),
    };
  }, [items]);
  // Festival offers still bookable from today. Festival prices apply only to
  // service dates inside a festival window; Regular to all other dates.
  const festivals = useMemo(() => upcomingFestivals(pricing?.festivals ?? [], todayIST()), [pricing]);
  const [priceMode, setPriceMode] = useState<PriceType | "">("");
  // Festival campaign running today → festival packages ONLY: no regular selector, and the festival mode
  // cannot be switched off for full-home packages. The server still prices by service date (authoritative).
  const campaign = useMemo(() => activeCampaign(pricing?.festivals ?? [], todayIST()), [pricing]);
  useEffect(() => {
    if (campaign || (festivals.length && /[?&]price=festival/i.test(window.location.search))) setPriceMode("FESTIVAL");
  }, [campaign, festivals.length]);
  const [category, setCategory] = useState<Category | "">(preset ? "HOME" : (defaultCategory ?? ""));
  // Home
  const [bhk, setBhk] = useState(preset?.bhk ?? "");
  const [homeType, setHomeType] = useState<"FULL" | "CUSTOM" | "COMBO" | "">(preset ? "FULL" : "");
  const [pkg, setPkg] = useState<string>(preset?.pkg ?? "");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [combos, setCombos] = useState<Record<string, boolean>>({});
  // Commercial / Pest / Painting
  const [comType, setComType] = useState("");
  const [area, setArea] = useState("");
  const [pest, setPest] = useState("");
  const [pestSize, setPestSize] = useState("");
  const [paint, setPaint] = useState("");
  const [paintProperty, setPaintProperty] = useState("");
  const [paintJob, setPaintJob] = useState("");
  const [paintSide, setPaintSide] = useState<"Interior" | "Exterior" | "">("");
  const [sqft, setSqft] = useState("");
  const [putty, setPutty] = useState(false);
  const [comFreq, setComFreq] = useState("");
  // Landing-page service cards ("View Packages") open a service here without a reload.
  useEffect(() => {
    const onPick = (e: Event) => {
      const c = (e as CustomEvent<string>).detail;
      if (c === "HOME" || c === "COMMERCIAL" || c === "PEST" || c === "PAINTING") setCategory(c);
      // Home: open the full-home packages straight away (BHK + Premium/Platinum), not a bare list of
      // choices. During a running festival campaign that is the festival package.
      if (c === "HOME") {
        setHomeType((t) => t || "FULL");
        if (campaign) setPriceMode("FESTIVAL");
      }
    };
    window.addEventListener("sahara:select-service", onPick);
    // The compact price selector (BHK → package) hands its choice to this form.
    const onPackage = (e: Event) => {
      const d = (e as CustomEvent<{ bhk?: string; tier?: string }>).detail;
      if (!d?.bhk) return;
      setCategory("HOME");
      setHomeType("FULL");
      if (campaign) setPriceMode("FESTIVAL");
      setBhk(d.bhk);
      setPkg(d.tier ?? "");
      setPkgEdit(false);
    };
    window.addEventListener("sahara:select-package", onPackage);
    return () => {
      window.removeEventListener("sahara:select-service", onPick);
      window.removeEventListener("sahara:select-package", onPackage);
    };
  }, [campaign]);
  // Schedule / details
  const [dates, setDates] = useState<{ date: string; available: boolean; status: DayStatus }[] | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ slot: string; available: boolean }[] | null>(null);
  const [slot, setSlot] = useState("");
  // Mobile only (< sm): completed steps collapse into one-line summaries. Desktop ignores these.
  const [svcDone, setSvcDone] = useState(false);
  const [pkgEdit, setPkgEdit] = useState(false);
  // Desktop keeps the full scope open; on phones it starts collapsed to save scrolling.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => setIsDesktop(window.matchMedia("(min-width: 640px)").matches), []);
  const [dateDone, setDateDone] = useState(false);
  useEffect(() => setDateDone(!!slot), [slot]);
  // Fixed festival prices exist for home cleaning only.
  const festivalApplies = !quote && festivals.length > 0;
  const activeFestival = priceMode === "FESTIVAL" ? ((date ? festivalForDate(festivals, date) : null) ?? festivals[0] ?? null) : null;
  const unit = (it: PriceItem) => unitPriceFor(it, activeFestival);
  const [name, setName] = useState(quote?.customerName ?? prefill?.name ?? "");
  const [mobile, setMobile] = useState(quote?.mobile ?? prefill?.mobile ?? "");
  const [altMobile, setAltMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [locating, setLocating] = useState(false);
  const [pay, setPay] = useState<"PAY_ADVANCE" | "PAY_AFTER_SERVICE" | "">("");
  // WhatsApp marketing consent: optional, NEVER pre-ticked, and independent of the booking itself
  // (booking confirmations / reminders are transactional and do not depend on it).
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Hide the mobile sticky bar once the summary (with its own Confirm) is on or above screen.
  const [pastSummary, setPastSummary] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = document.getElementById("bk-summary");
      if (el) setPastSummary(el.getBoundingClientRect().top < window.innerHeight - 120);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  useEffect(() => {
    getDateAvailability(45)
      .then((d) => {
        setDates(d);
        // Open on the month of the first bookable date (not an all-past month).
        const first = d[0]?.date;
        const firstOpen = d.find((x) => x.available)?.date;
        if (first && firstOpen) {
          const [y0, m0] = first.split("-").map(Number);
          const [y1, m1] = firstOpen.split("-").map(Number);
          setMonthOffset((y1 - y0) * 12 + (m1 - m0));
        }
      })
      .catch(() => setDates([]));
  }, []);
  useEffect(() => {
    setSlot("");
    setSlots(null);
    if (!date) return;
    getSlotAvailability(date).then((r) => setSlots(r.ok ? r.slots : [])).catch(() => setSlots([]));
  }, [date]);

  // Selected lines + dynamic total (priced lines only; no minimum booking value).
  const lines: Line[] = useMemo(() => {
    if (quote) return quote.services.map((s) => ({ label: s, amount: null }));
    const out: Line[] = [];
    if (category === "HOME" && homeType === "FULL" && bhk && pkg) {
      const item = items.find((p) => p.bhk === bhk && p.variant === pkg);
      out.push(item ? { label: `${bhk} ${pkg} Deep Cleaning`, amount: unit(item) } : { label: `${bhk} ${pkg} Deep Cleaning`, amount: null, note: "Price on confirmation" });
      // Add-ons on top of the full-home package (same priced catalogue items).
      for (const it of ADDON_ITEMS) {
        const n = qty[it.contentId] ?? 0;
        const u = unit(it);
        if (n > 0) out.push({ label: `+ ${it.name} × ${n}`, amount: u == null ? null : u * n, note: u == null ? it.priceNote : undefined });
      }
    }
    if (category === "HOME" && homeType === "CUSTOM") {
      for (const it of CUSTOMISED) {
        const n = qty[it.contentId] ?? 0;
        const u = unit(it);
        if (n > 0) out.push({ label: `${it.name} × ${n}`, amount: u == null ? null : u * n, note: u == null ? it.priceNote : undefined });
      }
    }
    if (category === "HOME" && (homeType === "CUSTOM" || homeType === "COMBO")) {
      for (const c of homeType === "COMBO" ? PACKAGE_COMBOS : ADDON_COMBOS) if (combos[c.contentId]) out.push({ label: c.name, amount: unit(c) });
    }
    if (category === "COMMERCIAL" && comType) out.push({ label: `${comType} Cleaning${area ? ` · ${area} sq ft` : ""}${comFreq ? ` · ${comFreq}` : ""}`, amount: null, note: "Quote after requirement check" });
    if (category === "PEST" && pest) out.push({ label: `${pest}${pestSize ? ` · ${pestSize}` : ""}`, amount: null, note: "Price after inspection" });
    if (category === "PAINTING" && paintSide === "Exterior" && paintJob) {
      out.push({ label: `${paintJob} · Exterior painting${paintProperty ? ` · ${paintProperty}` : ""}${Number(sqft) ? ` · ${Number(sqft)} sq ft` : ""}`, amount: null, note: "Quote after site inspection" });
    } else if (category === "PAINTING" && paint) {
      const item = PAINTS.find((p) => p.contentId === paint)!;
      const s = Number(sqft) || 0;
      const rate = item.price == null ? null : item.price + (putty && PUTTY?.price ? PUTTY.price : 0);
      out.push({
        label: `${paintJob ? `${paintJob} · ` : ""}Interior · ${item.name}${paintProperty ? ` · ${paintProperty}` : ""}${s ? ` · ${s} sq ft` : ""}${putty ? " + putty" : ""}`,
        amount: rate != null && s > 0 ? rate * s : null,
        note: rate == null ? "Price after inspection" : s > 0 ? "Estimate — final after site measurement" : "Enter area for an estimate",
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, category, homeType, bhk, pkg, qty, combos, comType, area, comFreq, pest, pestSize, paint, paintProperty, paintJob, paintSide, sqft, putty, items, activeFestival]);

  const pricedTotal = quote ? quote.totalAmount : lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  const hasUnpriced = !quote && lines.some((l) => l.amount == null);
  const addOnOnlyAlone = !quote && lines.length > 0 && lines.every((l) => COMBOS.find((c) => c.name === l.label)?.addOnOnly);
  const needsPriceMode = festivalApplies && category === "HOME";
  // Campaign running: full-home packages can never fall back to regular pricing from the UI.
  useEffect(() => {
    if (campaign && category === "HOME" && homeType === "FULL" && priceMode !== "FESTIVAL") {
      setPriceMode("FESTIVAL");
      if (date && !festivalForDate(festivals, date)) setDate("");
    }
  }, [campaign, category, homeType, priceMode, date, festivals]);
  // Festival / Regular each allow only some dates — open the calendar on the first
  // bookable month for the chosen mode, not an all-greyed month.
  useEffect(() => {
    if (!dates || !needsPriceMode || !priceMode) return;
    const first = dates[0]?.date;
    const target = dates.find((d) => d.available && (priceMode === "FESTIVAL") === !!festivalForDate(festivals, d.date))?.date;
    if (!first || !target) return;
    const [y0, m0] = first.split("-").map(Number);
    const [y1, m1] = target.split("-").map(Number);
    setMonthOffset((y1 - y0) * 12 + (m1 - m0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceMode, dates, needsPriceMode]);
  const serviceChosen = quote
    ? true
    : lines.length > 0 &&
      (!needsPriceMode || !!priceMode) &&
      !addOnOnlyAlone &&
      (category !== "PEST" || !!pestSize) &&
      (category !== "PAINTING" ||
        (!!paintProperty && !!paintJob && !!paintSide &&
          (paintSide === "Exterior" || Number(sqft) > 0 || PAINTS.find((p) => p.contentId === paint)?.price == null)));
  const altDigits = altMobile.replace(/\D/g, "");
  const detailsOk =
    quote ||
    (name.trim().length >= 2 &&
      /^\d{10}$/.test(mobile.replace(/\D/g, "").slice(-10)) &&
      address.trim().length >= 5 &&
      (!altDigits || altDigits.length >= 10) &&
      (!pinCode.trim() || /^\d{6}$/.test(pinCode.trim())) &&
      (!email.trim() || /^\S+@\S+\.\S+$/.test(email.trim())));

  function useCurrentLocation() {
    if (!navigator.geolocation) return setError("Location isn't available on this device — please type your full address.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMapLink(`https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location — please type your full address.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  // 4 BHK+, villa, bungalow, full house: no instant price — a site inspection and written quotation come first.
  const inspection = category === "HOME" && homeType === "FULL" && needsInspection(bhk);
  useEffect(() => {
    // Nothing is charged before an approved quotation, so the payment choice is fixed to "after service".
    if (inspection && pay !== "PAY_AFTER_SERVICE") setPay("PAY_AFTER_SERVICE");
  }, [inspection, pay]);
  const ready = serviceChosen && date && slot && pay && detailsOk;

  function mapping() {
    if (category === "HOME" && homeType === "FULL") {
      return { serviceCategory: "HOME_DEEP_CLEANING", serviceVariant: pkg, packageName: `${bhk} ${pkg}`, propertyType: bhk };
    }
    if (category === "HOME") {
      const first = homeType === "CUSTOM" ? CUSTOMISED.find((it) => (qty[it.contentId] ?? 0) > 0) : undefined;
      // Individual Cleaning removed (owner 2026-10-05): itemised home services are a Customized Service.
      return { serviceCategory: first ? "CUSTOMIZER_PACKAGE" : "COMBO_PACKAGE", serviceVariant: first?.variant ?? "", packageName: "", propertyType: "" };
    }
    if (category === "COMMERCIAL") return { serviceCategory: "COMMERCIAL_CLEANING", serviceVariant: comType, packageName: "", propertyType: comType };
    if (category === "PEST") return { serviceCategory: "PEST_CONTROL", serviceVariant: pest, packageName: "", propertyType: pestSize };
    const item = PAINTS.find((p) => p.contentId === paint);
    return { serviceCategory: "PAINTING", serviceVariant: item?.variant ?? "", packageName: paintJob, propertyType: paintProperty };
  }

  function selectedItems() {
    if (category !== "HOME") return [];
    if (homeType === "FULL") {
      const it = items.find((p) => p.bhk === bhk && p.variant === pkg);
      const addOns = ADDON_ITEMS.filter((a) => (qty[a.contentId] ?? 0) > 0).map((a) => ({ contentId: a.contentId, qty: qty[a.contentId] }));
      return it ? [{ contentId: it.contentId, qty: 1 }, ...addOns] : [];
    }
    return [
      ...(homeType === "CUSTOM" ? CUSTOMISED.filter((it) => (qty[it.contentId] ?? 0) > 0).map((it) => ({ contentId: it.contentId, qty: qty[it.contentId] })) : []),
      ...(homeType === "COMBO" ? PACKAGE_COMBOS : ADDON_COMBOS).filter((c) => combos[c.contentId]).map((c) => ({ contentId: c.contentId, qty: 1 })),
    ];
  }

  // Booking-funnel analytics: one event per choice (no-op without GA tags).
  useEffect(() => trackFunnel("view_service"), []);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!category) return;
    trackFunnel("select_service", { service: category });
    if (!started) {
      setStarted(true);
      trackFunnel("start_booking", { service: category });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);
  useEffect(() => {
    const c = homeType || comType || pest || paintJob;
    if (c) trackFunnel("select_category", { service: category, category: c, price_type: priceMode || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeType, comType, pest, paintJob, priceMode]);
  useEffect(() => {
    if (pkg || paint) trackFunnel("select_package", { service: category, package: [bhk, pkg || paint].filter(Boolean).join(" ") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg, paint, bhk]);
  const addonCount = Object.values(qty).reduce((t, n) => t + (n || 0), 0) + Object.values(combos).filter(Boolean).length;
  useEffect(() => {
    if (addonCount > 0) trackFunnel("select_addon", { service: category, items: addonCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addonCount]);
  useEffect(() => {
    if (date) trackFunnel("select_date", { service: category });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
  useEffect(() => {
    if (slot) trackFunnel("select_time", { service: category, slot });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  function submit() {
    setError("");
    if (!ready) return setError("Please complete all steps.");
    trackFunnel("submit_booking", { service: category });
    const summary = lines.map((l) => `${l.label}${l.amount != null ? ` = ${inr(l.amount)}` : l.note ? ` (${l.note})` : ""}`).join("; ");
    startTransition(async () => {
      try {
      const m = quote ? { serviceCategory: "HOME_DEEP_CLEANING", serviceVariant: "", packageName: "", propertyType: "" } : mapping();
      const res = await publicBookLead({
        name: name.trim(),
        mobile: mobile.replace(/\D/g, "").slice(-10),
        alternateMobile: altDigits ? altDigits.slice(-10) : "",
        email: email.trim(),
        area: address.trim().slice(0, 80),
        address: address.trim(),
        pinCode: pinCode.trim(),
        mapLink,
        ...m,
        comboServices: lines.filter((l) => COMBOS.some((c) => c.name === l.label)).map((l) => l.label),
        // Full-home add-ons, so the CRM lead lists them alongside the package.
        addOnServices: lines.filter((l) => l.label.startsWith("+ ")).map((l) => l.label.slice(2)),
        // Price snapshot — the server re-prices these items and freezes the amount on the lead.
        priceType: category === "HOME" && !quote ? (priceMode === "FESTIVAL" ? "FESTIVAL" : "REGULAR") : undefined,
        selectedItems: quote ? [] : selectedItems(),
        estimatedAmount: pricedTotal > 0 ? pricedTotal : undefined,
        serviceDate: date,
        timeSlot: slot,
        paymentPreference: pay || undefined,
        marketingOptIn,
        quotationToken: quote?.token ?? "",
        referralCode: referralCode ?? "",
        notes: quote ? `Quotation ${quote.quoteNumber}` : `${inspection ? "SITE INSPECTION REQUIRED — " : ""}${campaignName ? `${campaignName} — ` : "Booking page — "}${summary}`,
        // Empty: the server derives the lead source from the detected channel (Google Ads,
        // Meta, GBP…) and falls back to WEBSITE — a hard-coded WEBSITE hid ad leads.
        source: "",
        attribution: getAttributionPayload(),
      });
      if ("error" in res && res.error) return setError(res.error);
      trackLead({ category: m.serviceCategory, variant: m.serviceVariant, mobile });
      trackFunnel("booking_confirmation", { service: m.serviceCategory, variant: m.serviceVariant });
      setDone("leadNumber" in res ? (res.leadNumber ?? "") : "");
      } catch {
        // Never show success on a failed/uncertain submit. Retrying is safe: the server reuses an
        // open enquiry for the same mobile instead of creating a duplicate lead.
        setError("We couldn't send your request just now. Please check your connection and tap the button again — your details are still here. If it keeps failing, call us on 8956567130 / 7083347130.");
      }
    });
  }

  if (done !== null && closed) {
    return (
      <div id="bk-done" className={`${card} scroll-mt-20 text-center`}>
        <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
        <h3 className="mt-2 text-lg font-bold">Booking request received</h3>
        <p className="mt-1 text-sm text-[#0a2540]/75">Reference: <span className="font-semibold">{done}</span> · {fmtDay(date)} · {slot}</p>
        <button type="button" onClick={() => setClosed(false)} className="mt-3 min-h-11 rounded-xl border border-primary/40 px-5 text-sm font-bold text-primary">View payment details</button>
      </div>
    );
  }
  if (done !== null) {
    const bd = advanceBreakdown(pricedTotal, pay);
    const advanceDue = !quote && pay === "PAY_ADVANCE" && pricedTotal > 0 && !inspection;
    return (
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="bk-done-title">
        <div id="bk-done" className="mx-auto my-4 w-full max-w-lg rounded-2xl bg-white p-4 text-center shadow-2xl sm:p-6">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
          <h3 id="bk-done-title" className="mt-2 text-xl font-bold">Booking request received</h3>
          <p className="mt-1 text-sm text-[#0a2540]/75">Reference: <span className="font-semibold">{done}</span></p>
          <p className="mt-1 text-sm text-[#0a2540]/75">{fmtDay(date)} · {slot}</p>

          {pricedTotal > 0 && !inspection && (
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center" aria-label="Payment breakdown">
              <div className="rounded-xl bg-[#eef4fb] p-2"><dt className="text-[11px] font-semibold text-[#0a2540]/60">Total amount</dt><dd className="text-base font-extrabold text-primary">{inr(bd.total)}</dd></div>
              <div className="rounded-xl bg-amber-50 p-2"><dt className="text-[11px] font-semibold text-[#0a2540]/60">Advance payable</dt><dd className="text-base font-extrabold text-amber-800">{inr(bd.advance)}</dd></div>
              <div className="rounded-xl bg-[#eef4fb] p-2"><dt className="text-[11px] font-semibold text-[#0a2540]/60">After service</dt><dd className="text-base font-extrabold text-primary">{inr(bd.remaining)}</dd></div>
            </dl>
          )}

          {advanceDue && (
            <div className="mt-4 space-y-3 text-left">
              <p className="text-center text-sm font-bold">Pay the {inr(bd.advance)} advance to secure your slot</p>
              {paymentDetails ? (
                <>
                  <PaymentDetailsBox mode="QR" details={paymentDetails} large />
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#0a2540]/60">Or bank transfer (NEFT / IMPS / UPI)</p>
                    <PaymentDetailsBox mode="BANK" details={paymentDetails} />
                  </div>
                </>
              ) : (
                <p className="rounded-xl bg-[#eef4fb] p-3 text-center text-sm">Our team will share the payment QR and bank details on WhatsApp.</p>
              )}
              <p className="rounded-xl bg-primary/5 p-3 text-xs text-[#0a2540]/80">
                Payments by QR or bank transfer only. After paying, send the payment screenshot on WhatsApp — your payment is marked received only after our team verifies it.
              </p>
            </div>
          )}

          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            This is not yet a confirmed booking. Our team will confirm your slot shortly — you&apos;ll receive the confirmation with your booking link on WhatsApp.
          </p>
          <button type="button" onClick={() => setClosed(true)} className="mt-3 min-h-11 w-full rounded-xl border border-primary/40 text-sm font-bold text-primary">Close</button>
        </div>
      </div>
    );
  }

  const step = (n: number, title: string, doneFlag?: boolean) => (
    <h3 className="flex items-center gap-2 text-base font-bold sm:text-lg">
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm text-white ${doneFlag ? "bg-emerald-600" : "bg-primary"}`}>
        {doneFlag ? <Check className="size-4" /> : n}
      </span>
      {title}
    </h3>
  );
  // Honest starting prices on the main cards (live price list): the cheapest individual
  // service for Home (never presented as a full-home price) and the lowest paint rate per sq ft.
  const bathroom = CUSTOMISED.find((i) => /bathroom/i.test(i.name) && i.price != null);
  const startHome = bathroom ? `Starting from ${inr(bathroom.price!)}` : undefined;
  // Painting: no rate is shown — the card advertises the free site inspection instead.
  const startPaint = "Free Site Inspection";
  const section = (key: Category, icon: React.ReactNode, title: string, hint: string, body: React.ReactNode, price?: string) =>
    hidePicker ? (
      category === key ? (
        <div className="rounded-2xl border border-primary/40 bg-primary/[0.03]">
          <p className="flex items-center gap-2 border-b border-[#0a2540]/10 px-3.5 py-2.5 text-sm font-bold sm:px-4"><span className="text-primary">{icon}</span>{title}</p>
          <div className="space-y-4 p-3.5 sm:p-4">{body}</div>
        </div>
      ) : null
    ) : (
    <div className={`rounded-2xl border ${category === key ? "border-primary/40 bg-primary/[0.03]" : "border-[#0a2540]/10 bg-white"}`}>
      <button type="button" onClick={() => setCategory(category === key ? "" : key)} className="flex min-h-14 w-full items-center gap-3 p-3.5 text-left sm:p-4" aria-expanded={category === key}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <span className="flex-1">
          <span className="block font-bold">{title}</span>
          <span className="block text-xs text-[#0a2540]/60">{hint}</span>
          {price && <span className="mt-0.5 block text-[11px] font-semibold text-primary">{price}</span>}
        </span>
        <ChevronDown className={`size-5 transition ${category === key ? "rotate-180" : ""}`} />
      </button>
      {category === key && <div className="space-y-4 border-t border-[#0a2540]/10 p-3.5 sm:p-4">{body}</div>}
    </div>
    );
  const pkgPrice = (tier: HomeTier) => items.find((p) => p.bhk === bhk && p.variant === tier);
  // Festival price shown next to the regular price (first upcoming festival until a date is picked).
  const previewFestival = (date && festivalForDate(festivals, date)) || festivals[0] || null;
  const festivalPriceOf = (it: PriceItem) => (previewFestival ? (previewFestival.prices[it.contentId] ?? null) : null);
  const tier: HomeTier | null = category === "HOME" && homeType === "FULL" && isTier(pkg) ? pkg : null;
  const pleaseNote: string[] = tier
    ? homePleaseNote(tier)
    : category === "HOME"
      ? [
          "Minimum quantities apply where shown.",
          "Old, permanent or stubborn stains cannot be guaranteed for complete removal.",
          "Heavy furniture is not moved unless agreed.",
          "Additional work outside the listed scope may be chargeable.",
        ]
      : category === "PAINTING"
        ? ["Site inspection is free.", "Final price is confirmed after site measurement.", "Number of coats depends on site condition and the selected finish."]
        : ["Price is confirmed after inspection / requirement assessment.", "Additional work outside the agreed scope may be chargeable."];
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  // Mobile collapse flags (only ever applied through max-sm:/sm: classes).
  const pkgCollapsed = category === "HOME" && homeType === "FULL" && !!bhk && !!pkg && !pkgEdit && (!needsPriceMode || !!priceMode);
  const svcCollapsed = !quote && svcDone && serviceChosen;
  const dateCollapsed = (quote || svcCollapsed) && dateDone && !!date && !!slot;
  const nextStep = !serviceChosen ? "bk-service" : !date || !slot ? "bk-date" : !quote && !detailsOk ? "bk-details" : !pay ? "bk-pay" : "bk-summary";
  const showSticky = !quote && lines.length > 0 && !pastSummary;
  // What still blocks Confirm — shown above the button instead of a silent disabled state.
  const missing: { id: string; text: string }[] = [
    !serviceChosen && { id: "bk-service", text: category === "HOME" && needsPriceMode && !priceMode ? "Choose Festival or Regular, then a package" : "Choose a service / package" },
    serviceChosen && (!date || !slot) && { id: "bk-date", text: "Pick a date and an arrival time" },
    !quote && !!date && !!slot && !detailsOk && { id: "bk-details", text: "Add your name, 10-digit mobile and full address" },
    !!date && !!slot && !!detailsOk && !pay && { id: "bk-pay", text: "Choose a payment option" },
  ].filter(Boolean) as { id: string; text: string }[];
  // Progress: Service → Date & time → Details → Payment.
  const progress = quote
    ? []
    : [
        { label: "Service", done: serviceChosen },
        { label: "Date & time", done: !!date && !!slot },
        { label: "Details", done: !!detailsOk },
        { label: "Payment", done: !!pay },
      ];
  const currentStep = progress.findIndex((p) => !p.done);

  return (
    <div className="space-y-2 sm:space-y-4">
      {progress.length > 0 && (
        <ol className="grid grid-cols-4 gap-1.5 sm:hidden" aria-label="Booking progress">
          {progress.map((p, i) => {
            const state = p.done ? "done" : i === currentStep ? "current" : "todo";
            return (
              <li key={p.label} className="min-w-0">
                <span className={`block h-1.5 rounded-full ${state === "done" ? "bg-primary" : state === "current" ? "bg-primary/45" : "bg-[#0a2540]/10"}`} />
                <span className={`mt-1 block truncate text-[11px] font-semibold sm:text-xs ${state === "todo" ? "text-[#0a2540]/45" : "text-[#0a2540]"}`} aria-current={state === "current" ? "step" : undefined}>
                  {p.done ? "✓ " : `${i + 1}. `}
                  {p.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {quote ? (
        <div className={card}>
          {step(1, "Your quotation", true)}
          <p className="mt-2 text-sm">Quotation <span className="font-semibold">{quote.quoteNumber}</span> · {quote.customerName}</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-[#0a2540]/80">{quote.services.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="mt-2 text-xl font-extrabold text-primary">{inr(quote.totalAmount)}</p>
        </div>
      ) : (
        <div id="bk-service" className={`${card} scroll-mt-20 ${svcCollapsed ? "max-sm:hidden" : ""}`}>
          {step(1, hidePicker ? "Your package" : "Choose service & package", serviceChosen)}
          {hidePicker && !category && <p className="mt-3 rounded-xl bg-[#eef4fb] p-3 text-sm text-[#0a2540]/75">Tap a service above to see its packages and book.</p>}
          <div className="mt-3 space-y-2.5">
            {section("HOME", <Home className="size-5" />, "Home Cleaning", "Full Home Deep Cleaning, Sofa, Mattress & More", (
              <>
                {pkgCollapsed && (
                  <MobileSummaryRow label="Package" onChange={() => setPkgEdit(true)}>
                    {bhk} {pkg}{priceMode ? ` · ${priceMode === "FESTIVAL" ? "Festival" : "Regular"}` : ""}{lines[0]?.amount != null ? ` · ${inr(lines[0].amount)}` : ""}
                  </MobileSummaryRow>
                )}
                {/* Home: four compact choices — Festival / Regular full-home packages, Combos, Individual services. */}
                <div className={`grid grid-cols-2 gap-2 ${pkgCollapsed ? "max-sm:hidden" : ""}`}>
                  {([
                    ...(festivalApplies
                      ? [{ key: "FEST", title: "Festival Home Cleaning", sub: `Service dates ${shortDay(festivals[0].start)}–${shortDay(festivals.reduce((e, f) => (f.end > e ? f.end : e), festivals[0].end))}`, type: "FULL", mode: "FESTIVAL" }]
                      : []),
                    // The regular full-home option is hidden while the festival campaign runs.
                    ...(campaign
                      ? []
                      : [{ key: "REG", title: festivalApplies ? "After-Diwali / Regular Home Cleaning" : "Full Home Deep Cleaning", sub: festivalApplies ? "Service dates outside the festival" : "Premium & Platinum packages", type: "FULL", mode: "REGULAR" }]),
                    { key: "COMBO", title: "Combo Packages", sub: "Kitchen, bathroom & sofa combos", type: "COMBO", mode: "" },
                    { key: "CUSTOM", title: "Individual Cleaning Services", sub: "Bathroom, kitchen, sofa, mattress & more", type: "CUSTOM", mode: "" },
                  ] as const).map((c) => {
                    const on = homeType === c.type && (c.type !== "FULL" || !festivalApplies || priceMode === c.mode);
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                          if (homeType !== c.type) {
                            setQty({});
                            setCombos({});
                          }
                          setHomeType(c.type as "FULL" | "COMBO" | "CUSTOM");
                          if (c.mode === "FESTIVAL") {
                            setPriceMode("FESTIVAL");
                            if (date && !festivalForDate(festivals, date)) setDate("");
                          } else if (c.mode === "REGULAR") {
                            setPriceMode("REGULAR");
                            if (date && festivalForDate(festivals, date)) setDate("");
                          }
                        }}
                        className={`rounded-xl border p-2.5 text-left leading-tight ${on ? "border-primary bg-primary text-white" : "border-[#0a2540]/15 bg-white"}`}
                      >
                        <span className="block text-[13px] font-bold">{c.key === "FEST" ? "🪔 " : ""}{c.title}</span>
                        <span className={`mt-0.5 block text-[11px] font-medium ${on ? "text-white/85" : "text-[#0a2540]/60"}`}>{c.sub}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Combo / Individual during a festival: which dates (festival prices apply only inside the festival). */}
                {needsPriceMode && (homeType === "COMBO" || homeType === "CUSTOM") && (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => { setPriceMode("FESTIVAL"); if (date && !festivalForDate(festivals, date)) setDate(""); }} className={`${chip(priceMode === "FESTIVAL")} text-[12px] leading-tight`}>Festival dates</button>
                    <button type="button" onClick={() => { setPriceMode("REGULAR"); if (date && festivalForDate(festivals, date)) setDate(""); }} className={`${chip(priceMode === "REGULAR")} text-[12px] leading-tight`}>Other dates</button>
                  </div>
                )}
                {homeType === "FULL" && (
                  <>
                    <div className={pkgCollapsed ? "max-sm:hidden" : ""}>
                      <p className="mb-2 text-sm font-semibold">Property type</p>
                      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">{BHKS.map((b) => <button key={b} type="button" onClick={() => setBhk(b)} className={`${chip(bhk === b)} px-1 text-[11px] leading-tight sm:whitespace-nowrap sm:text-[13px] sm:leading-normal`}>{b}</button>)}</div>
                    </div>
                    {inspection && (
                      <div className={`rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 ${pkgCollapsed ? "max-sm:hidden" : ""}`} role="note">
                        <p className="font-bold">{INSPECTION_NOTE}</p>
                        <p className="mt-0.5 text-[13px]">For {bhk === "Other" ? "this property" : bhk}, our team first visits to assess the scope, then sends a written quotation. Pick your preferred inspection date and time, share your details, and we will call you. Nothing is charged before you approve the quotation.</p>
                      </div>
                    )}
                    {bhk && (
                      <div className={`grid gap-2.5 sm:grid-cols-2 ${pkgCollapsed ? "max-sm:hidden" : ""}`}>
                        {HOME_PACKAGES.map((t) => {
                          const it = isTier(t) && !inspection ? pkgPrice(t) : undefined;
                          const on = pkg === t;
                          return (
                            <button key={t} type="button" onClick={() => { setPkg(t); setPkgEdit(false); }} className={`rounded-2xl border p-3.5 text-left ${on ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-[#0a2540]/15 bg-white"}`}>
                              <span className="flex items-start justify-between gap-2">
                                <span>
                                  <span className="block text-base font-bold">{bhk} {t}</span>
                                  <span className="block text-[11px] font-semibold text-[#0a2540]/55">{HOME_DURATION}</span>
                                </span>
                                {it ? (
                                  (() => {
                                    const fest = priceMode === "FESTIVAL" ? festivalPriceOf(it) : null;
                                    return (
                                      <span className="shrink-0 text-right leading-tight">
                                        <span className="block text-[10px] font-semibold text-[#0a2540]/55">{fest != null ? "Festival price" : "Price"}</span>
                                        {/* Struck-through MRP only when the owner set one above the price (Settings → Pricing). */}
                                        {fest == null && it.mrp != null && it.mrp > it.price! && <span className="block text-[11px] text-[#0a2540]/45 line-through">{inr(it.mrp)}</span>}
                                        <span className="block text-base font-extrabold text-primary">{inr(fest ?? it.price!)}</span>
                                      </span>
                                    );
                                  })()
                                ) : (
                                  <span className="text-right text-[11px] font-semibold text-[#0a2540]/60">{inspection ? "Price on inspection" : "Price on confirmation"}</span>
                                )}
                              </span>
                              <span className="mt-2 block space-y-0.5 text-xs text-[#0a2540]/75 max-sm:hidden">
                                {isTier(t) && homeHighlights(t).slice(0, 3).map((h) => <span key={h} className="flex gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />{h}</span>)}
                              </span>
                              <span className={`mt-2.5 block rounded-lg py-1.5 text-center text-xs font-bold ${on ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>{on ? "Selected" : "Select"}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {bhk && pkg && (
                      <div className="rounded-2xl border border-[#0a2540]/10 bg-white p-3">
                        <button type="button" onClick={() => setAddonsOpen((o) => !o)} aria-expanded={addonsOpen} aria-controls="bk-addons" className="flex min-h-11 w-full items-center justify-between gap-2 text-left">
                          <span className="text-sm font-bold">
                            {addonsOpen ? "−" : "+"} Add Optional Services
                            {ADDON_ITEMS.some((it) => (qty[it.contentId] ?? 0) > 0) && (
                              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">{ADDON_ITEMS.filter((it) => (qty[it.contentId] ?? 0) > 0).length} added</span>
                            )}
                          </span>
                          <ChevronDown className={`size-4 shrink-0 transition ${addonsOpen ? "rotate-180" : ""}`} />
                        </button>
                        {addonsOpen && (
                        <div id="bk-addons" className="mt-2 divide-y divide-[#0a2540]/10">
                          {ADDON_ITEMS.map((it) => {
                            const n = qty[it.contentId] ?? 0;
                            const u = unit(it);
                            return (
                              <div key={it.contentId} className="flex items-center justify-between gap-2 py-1.5 sm:py-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold">{it.name}</p>
                                  <p className="text-[11px] text-[#0a2540]/60">
                                    {u != null ? `${inr(u)} ${it.unit ?? ""}` : it.priceNote}
                                    {it.minQty && it.minQty > 1 ? ` · min ${it.minQty}` : ""}
                                  </p>
                                </div>
                                <Stepper value={n} min={it.minQty ?? 1} onChange={(v) => setQty((q) => ({ ...q, [it.contentId]: v }))} />
                              </div>
                            );
                          })}
                        </div>
                        )}
                        {(() => {
                          const pkgAmt = lines[0]?.amount ?? 0;
                          const addAmt = lines.slice(1).reduce((s, l) => s + (l.amount ?? 0), 0);
                          return (
                            <div className="mt-2 space-y-0.5 rounded-xl bg-primary/5 p-2.5 text-sm">
                              <p className="flex justify-between"><span>Package</span><span className="font-semibold">{pkgAmt ? inr(pkgAmt) : "On confirmation"}</span></p>
                              <p className="flex justify-between"><span>Add-ons</span><span className="font-semibold">{inr(addAmt)}</span></p>
                              <p className="flex justify-between border-t border-[#0a2540]/10 pt-1 font-extrabold text-primary"><span>Live total</span><span>{inr(pkgAmt + addAmt)}{hasUnpriced ? " +" : ""}</span></p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}
                {homeType === "CUSTOM" && (
                  <div className="space-y-2">
                    {CUSTOMISED.map((it: PriceItem) => (
                      <div key={it.contentId} className={`rounded-xl border bg-white p-3 ${(qty[it.contentId] ?? 0) > 0 ? "border-primary/50" : "border-[#0a2540]/10"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold">{it.name}</p>
                            <p className="text-xs font-semibold text-primary">{unit(it) != null && unit(it) !== it.price ? `${inr(unit(it)!)} ${it.unit ?? ""} · ${activeFestival?.name} price` : priceLabel(it)}</p>
                          </div>
                          <Stepper value={qty[it.contentId] ?? 0} min={it.minQty ?? 1} onChange={(v) => setQty((q) => ({ ...q, [it.contentId]: v }))} />
                        </div>
                        {(it.rule || it.scope) && <p className="mt-1 text-[11px] font-semibold text-amber-700">{[it.rule, it.scope].filter(Boolean).join(" · ")}</p>}
                        {(qty[it.contentId] ?? 0) > 0 && unit(it) != null && <p className="mt-1 text-right text-sm font-bold">{inr(unit(it)! * qty[it.contentId])}</p>}
                      </div>
                    ))}
                    {ADDON_COMBOS.map((c) => (
                      <label key={c.contentId} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-[#0a2540]/10 bg-white p-3 text-sm">
                        <span className="flex items-center gap-2.5">
                          <input type="checkbox" className="size-5" checked={!!combos[c.contentId]} onChange={(e) => setCombos((m) => ({ ...m, [c.contentId]: e.target.checked }))} />
                          <span>
                            <span className="font-semibold">{c.name}</span>
                            <span className="block text-[11px] font-semibold text-amber-700">{c.rule}</span>
                          </span>
                        </span>
                        <span className="font-bold text-primary">{inr(unit(c)!)}</span>
                      </label>
                    ))}
                  </div>
                )}
                {homeType === "COMBO" && (
                  <div className="space-y-2">
                    {PACKAGE_COMBOS.map((c) => (
                      <label key={c.contentId} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-[#0a2540]/10 bg-white p-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <input type="checkbox" className="size-5 shrink-0" checked={!!combos[c.contentId]} onChange={(e) => setCombos((m) => ({ ...m, [c.contentId]: e.target.checked }))} />
                          <span className="min-w-0">
                            <span className="font-semibold">{c.name}</span>
                            {c.rule && <span className="block text-[11px] font-semibold text-amber-700">{c.rule}</span>}
                          </span>
                        </span>
                        <span className="shrink-0 font-bold text-primary">{inr(unit(c)!)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            ), startHome)}
            {section("COMMERCIAL", <Building2 className="size-5" />, "Office & Commercial", "Office, shop, clinic & commercial spaces · contracts", (
              <>
                <div>
                  <p className="mb-2 text-sm font-semibold">1. Property</p>
                  <div className="flex flex-wrap gap-2">{COMMERCIAL_ITEMS.map((c) => <button key={c.contentId} type="button" onClick={() => setComType(c.variant)} className={chip(comType === c.variant)}>{c.variant}</button>)}</div>
                </div>
                {comType && (
                  <div>
                    <p className="mb-2 text-sm font-semibold">2. Approximate area</p>
                    <input className={input} inputMode="numeric" placeholder="Area in sq ft (optional)" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, ""))} />
                  </div>
                )}
                {comType && (
                  <div>
                    <p className="mb-2 text-sm font-semibold">3. How often?</p>
                    <div className="grid grid-cols-2 gap-2">{COM_FREQUENCY.map((f) => <button key={f} type="button" onClick={() => setComFreq(f)} className={chip(comFreq === f)}>{f}</button>)}</div>
                  </div>
                )}
                <Accordion title="What's covered">
                  <ul className="space-y-1">{OFFICE_SCOPE.map((s) => <li key={s} className="flex gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />{s}</li>)}</ul>
                </Accordion>
                <p className="text-xs font-semibold text-primary">Business pricing depends on area and frequency — we send a written quote.</p>
              </>
            ), "Written quote after requirement check")}
            {section("PEST", <Bug className="size-5" />, "Pest Control", "Home, office & commercial pest control", (
              <>
                <div>
                  <p className="mb-2 text-sm font-semibold">1. Pest type</p>
                  <div className="flex flex-wrap gap-2">{PEST_ITEMS.map((p) => <button key={p.contentId} type="button" onClick={() => setPest(p.name)} className={chip(pest === p.name)}>{p.name}</button>)}</div>
                </div>
                {pest && (
                  <div>
                    <p className="mb-2 text-sm font-semibold">2. Property type</p>
                    <div className="flex flex-wrap gap-2">{PEST_SIZES.map((s) => <button key={s} type="button" onClick={() => setPestSize(s)} className={chip(pestSize === s)}>{s}</button>)}</div>
                  </div>
                )}
                {pest && (
                  <Accordion title={`How ${pest.toLowerCase()} works`}>
                    <p>{PEST_SERVICES.find((p) => p.name.startsWith(pest.split(" ")[0]))?.desc ?? "Inspection first, then a targeted treatment plan."}</p>
                  </Accordion>
                )}
                <p className="text-xs font-semibold text-primary">Price confirmed after a quick inspection of the affected areas.</p>
              </>
            ), "Price after inspection")}
            {section("PAINTING", <Paintbrush className="size-5" />, "Interior Painting", "Residential & full home painting · Asian Paints", (
              <>
                <div>
                  <p className="mb-2 text-sm font-semibold">1. Type of job</p>
                  <div className="grid grid-cols-2 gap-2">{PAINT_JOBS.map((s) => <button key={s} type="button" onClick={() => setPaintJob(s)} className={chip(paintJob === s)}>{s}</button>)}</div>
                </div>
                {paintJob && (
                  <div>
                    <p className="mb-2 text-sm font-semibold">2. Where?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["Interior", "Exterior"] as const).map((s) => (
                        <button key={s} type="button" onClick={() => setPaintSide(s)} className={chip(paintSide === s)}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {paintSide === "Interior" && (
                  <div>
                    <p className="mb-2 text-sm font-semibold">3. Paint system</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {PAINTS.map((p) => (
                        <button key={p.contentId} type="button" onClick={() => setPaint(p.contentId)} className={`rounded-xl border p-2.5 text-left text-sm ${paint === p.contentId ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-[#0a2540]/15 bg-white"}`}>
                          <span className="block font-semibold leading-tight">{p.name.replace(/^Asian /, "")}</span>
                          <span className="block text-xs text-primary">{priceLabel(p)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {paintSide === "Exterior" && <p className="rounded-xl bg-amber-50 p-2.5 text-xs font-semibold text-amber-900">Exterior painting is quoted after a free site inspection (surface condition and access vary).</p>}
                {(paintSide === "Exterior" || paint) && (
                  <div>
                    <p className="mb-2 text-sm font-semibold">{paintSide === "Exterior" ? "3" : "4"}. Property &amp; area</p>
                    <div className="flex flex-wrap gap-2">{PAINT_PROPERTIES.map((s) => <button key={s} type="button" onClick={() => setPaintProperty(s)} className={chip(paintProperty === s)}>{s}</button>)}</div>
                    <input className={`${input} mt-2`} inputMode="numeric" placeholder="Paintable area (sq ft)" value={sqft} onChange={(e) => setSqft(e.target.value.replace(/\D/g, ""))} />
                    {paintSide === "Interior" && PUTTY && (
                      <label className="mt-1 flex min-h-11 items-center gap-2.5 text-sm">
                        <input type="checkbox" className="size-5" checked={putty} onChange={(e) => setPutty(e.target.checked)} /> Add putty (priced in your quote)
                      </label>
                    )}
                  </div>
                )}
                {paintSide === "Interior" && paint && (() => {
                  const item = PAINTS.find((p) => p.contentId === paint);
                  const s = Number(sqft) || 0;
                  const rate = item?.price == null ? null : item.price + (putty && PUTTY?.price ? PUTTY.price : 0);
                  return rate != null ? (
                    <div className="rounded-xl bg-primary/5 p-2.5 text-sm">
                      <p className="flex justify-between"><span>{item!.name.replace(/^Asian /, "")}{putty ? " + putty" : ""}</span><span>{inr(rate)}/sq ft</span></p>
                      <p className="flex justify-between"><span>× Area</span><span>{s ? `${s} sq ft` : "—"}</span></p>
                      <p className="flex justify-between border-t border-[#0a2540]/10 pt-1 font-extrabold text-primary"><span>Estimated amount</span><span>{s ? inr(rate * s) : "Enter area"}</span></p>
                      <p className="mt-1 text-[11px] text-[#0a2540]/60">Estimate only — final quote after site measurement and surface check.</p>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-900">Free Site Inspection — our team visits, measures and sends a written quote. Nothing is charged before you approve it.</p>
                  );
                })()}
                <Accordion title="View painting scope">
                  <dl className="space-y-1.5">
                    {PAINT_SCOPE_STEPS.map(([k, v]) => (
                      <div key={k}>
                        <dt className="font-semibold">{k}</dt>
                        <dd className="text-[#0a2540]/75">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Accordion>
              </>
            ), startPaint)}
          </div>
        </div>
      )}

      {/* Package details: price → highlights → full scope → please note → terms */}
      {!quote && lines.length > 0 && (
        <div className={`${card} ${svcCollapsed ? "max-sm:hidden" : ""}`}>
          {step(2, "Package details & scope")}
          <div className="mt-3 rounded-xl bg-[#0a2540]/[0.03] p-3 text-sm">
            {lines.map((l) => (
              <p key={l.label} className="flex justify-between gap-3 py-0.5">
                <span>{l.label}</span>
                <span className="shrink-0 font-semibold">{l.amount != null ? inr(l.amount) : <span className="text-xs text-[#0a2540]/60">{l.note}</span>}</span>
              </p>
            ))}
            {pricedTotal > 0 && (
              <p className="mt-1.5 flex justify-between border-t border-[#0a2540]/10 pt-1.5 font-extrabold">
                <span>Total</span>
                <span className="text-primary">{inr(pricedTotal)}{hasUnpriced ? " +" : ""}</span>
              </p>
            )}
            {addOnOnlyAlone && <p className="mt-1 text-xs font-semibold text-red-600">This combo is an add-on — please add another service.</p>}
          </div>
          {needsPriceMode && priceMode && (
            <p className="mt-2 rounded-xl bg-primary/5 px-3 py-2 text-xs font-semibold text-[#0a2540]">
              {priceMode === "FESTIVAL"
                ? "Diwali & Festival Special Offer — for service dates during the festival. Festival slots are subject to team availability."
                : "Regular price — for service dates outside the festival dates."}
            </p>
          )}
          <p className="mt-2 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs font-medium italic leading-relaxed text-amber-900">{PRICE_NOTE}</p>

          {tier && (
            <ul className="mt-3 grid gap-1 text-sm max-sm:hidden sm:grid-cols-2">
              {homeHighlights(tier).map((h) => <li key={h} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{h}</li>)}
            </ul>
          )}

          <div className="mt-3 divide-y divide-[#0a2540]/10 overflow-hidden rounded-xl border border-[#0a2540]/10">
            <details className="group bg-white" open={!!tier && isDesktop}>
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-sm font-bold">
                Full scope of work
                <ChevronDown className="size-4 transition group-open:rotate-180" />
              </summary>
              <div className="space-y-3 px-3 pb-3 text-sm">
                {tier ? (
                  homeScopeByArea(tier).map((a) => (
                    <div key={a.area}>
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">{a.area}</p>
                      <ul className="mt-1 space-y-1">
                        {a.items.map((i) => (
                          <li key={i.item} className="flex gap-1.5 text-[13px]">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                            <span><span className="font-semibold">{i.item}:</span> {i.method}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : category === "HOME" ? (
                  <ul className="space-y-1.5 text-[13px]">
                    {CUSTOMISED.filter((it) => (qty[it.contentId] ?? 0) > 0).map((it) => (
                      <li key={it.contentId}><span className="font-semibold">{it.name}:</span> {smallServiceNotes(it).join(" · ") || "As listed"}</li>
                    ))}
                    {COMBOS.filter((c) => combos[c.contentId]).map((c) => <li key={c.contentId}><span className="font-semibold">{c.name}:</span> combo package{c.rule ? ` · ${c.rule}` : ""}</li>)}
                  </ul>
                ) : category === "COMMERCIAL" ? (
                  <ul className="space-y-1 text-[13px]">{OFFICE_SCOPE.map((s) => <li key={s} className="flex gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />{s}</li>)}</ul>
                ) : category === "PEST" ? (
                  <p className="text-[13px]">{PEST_SERVICES.find((p) => p.name.startsWith(pest.split(" ")[0]))?.desc ?? "Inspection first, then a targeted treatment plan."}</p>
                ) : (
                  <ul className="space-y-1 text-[13px]">{PAINT_SCOPE.map((s) => <li key={s} className="flex gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />{s}</li>)}</ul>
                )}
                {category !== "PAINTING" && category !== "PEST" && (
                  <p className="text-xs text-[#0a2540]/65"><span className="font-semibold">Equipment we bring:</span> {EQUIPMENT.join(" · ")}</p>
                )}
              </div>
            </details>
            <details className="group bg-white">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-sm font-bold">
                Please note · not included · extra
                <ChevronDown className="size-4 transition group-open:rotate-180" />
              </summary>
              <ul className="space-y-1 px-3 pb-3 text-[13px] text-[#0a2540]/80">{pleaseNote.map((s) => <li key={s} className="flex gap-1.5"><X className="mt-0.5 size-3.5 shrink-0 text-red-500" />{s}</li>)}</ul>
            </details>
            <details className="group bg-white">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-sm font-bold">
                Customer requirements & terms
                <ChevronDown className="size-4 transition group-open:rotate-180" />
              </summary>
              <div className="px-3 pb-3 text-[13px] text-[#0a2540]/80">
                <p className="font-semibold">Please arrange:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">{CUSTOMER_REQUIREMENTS.map((s) => <li key={s}>{s}</li>)}</ul>
                <p className="mt-2 font-semibold">Terms</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5">{[...BOOKING_TERMS, ...TERMS.filter((t) => !BOOKING_TERMS.includes(t))].map((t) => <li key={t}>{t}</li>)}</ol>
              </div>
            </details>
          </div>
        </div>
      )}

      {svcCollapsed && (
        <MobileSummaryRow label="Service" onChange={() => { setSvcDone(false); setTimeout(() => go("bk-service"), 50); }}>
          {lines.map((l) => l.label).join(", ")}{pricedTotal > 0 ? ` · ${inr(pricedTotal)}` : ""}
        </MobileSummaryRow>
      )}
      {!quote && serviceChosen && !svcDone && (
        <button type="button" onClick={() => { setSvcDone(true); setTimeout(() => go("bk-date"), 50); }} className="min-h-12 w-full rounded-xl bg-primary text-sm font-bold text-white sm:hidden">
          Continue to date &amp; time
        </button>
      )}
      {dateCollapsed && (
        <MobileSummaryRow label="Date & time" onChange={() => { setDateDone(false); setTimeout(() => go("bk-date"), 50); }}>
          {fmtDay(date)} · {slot}
        </MobileSummaryRow>
      )}
      {(quote || serviceChosen) && (
      <div id="bk-date" className={`${card} scroll-mt-20 ${(!quote && !svcDone) || dateCollapsed ? "max-sm:hidden" : ""}`}>
        {step(quote ? 2 : 3, "Preferred date & time", !!date && !!slot)}
        {!dates ? (
          <div className="mt-3 grid grid-cols-7 gap-1">{Array.from({ length: 35 }, (_, i) => <span key={i} className="h-10 animate-pulse rounded-lg bg-[#0a2540]/5" />)}</div>
        ) : (
          <>
            {needsPriceMode && priceMode && (
              <p className="mt-2 text-xs font-semibold text-[#0a2540]/70">
                {priceMode === "FESTIVAL" ? "Showing festival dates only." : "Showing dates outside the festival period only."}{" "}
                <button type="button" onClick={() => go("bk-service")} className="text-primary underline">Change</button>
              </p>
            )}
            <BookingCalendar
              dates={
                needsPriceMode && priceMode
                  ? dates.map((d) => ({ ...d, available: d.available && (priceMode === "FESTIVAL") === !!festivalForDate(festivals, d.date) }))
                  : dates
              }
              value={date}
              onChange={setDate}
              monthOffset={monthOffset}
              setMonthOffset={setMonthOffset}
            />
          </>
        )}
        {date && (
          !slots ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[#0a2540]/60"><Loader2 className="size-4 animate-spin" /> Loading time slots…</p>
          ) : (
            <>
              <p className="mt-3 text-sm font-semibold">Arrival time · {fmtDay(date)}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {slots.map((s) => (
                  <button
                    key={s.slot}
                    type="button"
                    disabled={!s.available}
                    onClick={() => setSlot(s.slot)}
                    className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-semibold ${slot === s.slot ? "border-primary bg-primary text-white" : s.available ? "border-[#0a2540]/15 bg-white hover:border-primary/40" : "cursor-not-allowed bg-[#0a2540]/5 text-[#0a2540]/35"}`}
                  >
                    <Clock className="size-3.5" /> {s.slot}
                    {!s.available && <span className="text-[10px]">· Full</span>}
                  </button>
                ))}
              </div>
            </>
          )
        )}
      </div>
      )}

      {!quote && !!date && !!slot && (
        <div id="bk-details" className={`${card} scroll-mt-20 ${dateCollapsed ? "" : "max-sm:hidden"}`}>
          {step(4, "Your details", name.trim().length >= 2 && /^\d{10}$/.test(mobile.replace(/\D/g, "").slice(-10)))}
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div>
              <input className={input} autoComplete="name" placeholder="Full name *" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!name && name.trim().length < 2} />
              <FieldHint show={!!name && name.trim().length < 2}>Enter your full name</FieldHint>
            </div>
            <div>
              <input className={input} autoComplete="tel" type="tel" placeholder="Mobile number *" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} aria-invalid={!!mobile && !/^\d{10}$/.test(mobile.replace(/\D/g, "").slice(-10))} />
              <FieldHint show={!!mobile && !/^\d{10}$/.test(mobile.replace(/\D/g, "").slice(-10))}>Enter a 10-digit mobile number</FieldHint>
            </div>
            <div>
              <input className={input} type="tel" placeholder="Alternate mobile (optional)" inputMode="numeric" value={altMobile} onChange={(e) => setAltMobile(e.target.value)} />
              <FieldHint show={!!altDigits && altDigits.length < 10}>Enter a 10-digit number, or leave it blank</FieldHint>
            </div>
            <div>
              <input className={input} autoComplete="email" placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <FieldHint show={!!email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())}>Enter a valid email, or leave it blank</FieldHint>
            </div>
          </div>
        </div>
      )}

      {!quote && !!date && !!slot && (
        <div id="bk-address" className={`${card} scroll-mt-20 ${dateCollapsed ? "" : "max-sm:hidden"}`}>
          {step(5, "Service address", address.trim().length >= 5)}
          <textarea className={`${input} mt-3 h-24 py-2.5`} autoComplete="street-address" placeholder="Full address * (flat, building / society, area, landmark)" value={address} onChange={(e) => setAddress(e.target.value)} />
          <FieldHint show={!!address && address.trim().length < 5}>Add flat, building / society and area</FieldHint>
          <input className={`${input} mt-2`} autoComplete="postal-code" placeholder="PIN code (6 digits, optional)" inputMode="numeric" maxLength={6} value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))} />
          <FieldHint show={!!pinCode.trim() && !/^\d{6}$/.test(pinCode.trim())}>PIN code must be 6 digits</FieldHint>
          <button
            type="button"
            onClick={useCurrentLocation}
            className={`mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${mapLink ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-primary/40 text-primary"}`}
          >
            {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
            {mapLink ? "Google Maps location added ✓" : "Add Google Maps location (optional)"}
          </button>
          <label htmlFor="bk-marketing-optin" className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl bg-[#f6f9fc] p-3 text-[13px] leading-snug text-[#0a2540]/85">
            <input id="bk-marketing-optin" type="checkbox" className="mt-0.5 size-5 shrink-0" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
            <span>
              <span className="font-semibold">Send me WhatsApp updates and offers from Sahara Cleaning Services (optional).</span>{" "}
              Your booking does not depend on this. You can reply STOP at any time to opt out.
            </span>
          </label>
        </div>
      )}

      {(quote ? !!date && !!slot : !!date && !!slot && !!detailsOk) && (
      <div id="bk-pay" className={`${card} scroll-mt-20 ${quote || dateCollapsed ? "" : "max-sm:hidden"}`}>
        {step(quote ? 3 : 6, "Payment *", !!pay)}
        {inspection && (
          <p className="mt-3 rounded-xl bg-primary/5 p-3 text-sm font-medium text-[#0a2540]/85">No payment is taken now. The final price is confirmed in a written quotation after our site inspection.</p>
        )}
        <div className={`mt-3 grid grid-cols-2 gap-2 ${inspection ? "hidden" : ""}`}>
          {([
            ["PAY_ADVANCE", "Pay Advance"],
            ["PAY_AFTER_SERVICE", "Pay After Service"],
          ] as const).map(([v, t]) => (
            <button key={v} type="button" onClick={() => setPay(v)} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-semibold ${pay === v ? "border-primary bg-primary text-white" : "border-[#0a2540]/15 bg-white"}`}>
              <Wallet className="size-4" /> {t}
            </button>
          ))}
        </div>
      </div>
      )}

      {(quote || serviceChosen) && (
      <div id="bk-summary" className={`${card} scroll-mt-20 border-2 border-primary/20`}>
        <h3 className="text-base font-bold sm:text-lg">Booking summary</h3>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-[#0a2540]/60">Service</dt>
          <dd className="font-medium">{lines.length ? lines.map((l) => l.label).join(", ") : quote ? quote.services.join(", ") : "—"}</dd>
          {needsPriceMode && priceMode && !inspection && (
            <>
              <dt className="text-[#0a2540]/60">Price</dt>
              <dd className="font-medium">{priceMode === "FESTIVAL" ? "Diwali & Festival Special Offer" : "Regular"}</dd>
            </>
          )}
          <dt className="text-[#0a2540]/60">Date</dt>
          <dd className="font-medium">{date ? fmtDay(date) : "—"}</dd>
          <dt className="text-[#0a2540]/60">Time</dt>
          <dd className="font-medium">{slot || "—"}</dd>
          {!quote && (
            <>
              <dt className="text-[#0a2540]/60">Address</dt>
              <dd className="line-clamp-2 font-medium">{address.trim() || "—"}</dd>
            </>
          )}
          <dt className="text-[#0a2540]/60">Payment</dt>
          <dd className="font-medium">{pay === "PAY_ADVANCE" ? "Pay advance" : pay === "PAY_AFTER_SERVICE" ? "Pay after service" : "—"}</dd>
          <dt className="text-[#0a2540]/60">{quote ? "Quoted amount" : "Total"}</dt>
          <dd className="font-extrabold text-primary">
            {pricedTotal > 0 ? inr(pricedTotal) : lines.length ? "After inspection" : "—"}
            {hasUnpriced && pricedTotal > 0 && <span className="ml-1 text-xs font-medium text-[#0a2540]/60">+ items priced before booking</span>}
          </dd>
          {!quote && pricedTotal > 0 && !inspection && (
            <>
              <dt className="text-[#0a2540]/60">Advance payable{pay === "PAY_ADVANCE" ? ` (${ADVANCE_PERCENT}%)` : ""}</dt>
              <dd className="font-bold">{pay ? inr(advanceBreakdown(pricedTotal, pay).advance) : "Choose payment above"}</dd>
              <dt className="text-[#0a2540]/60">Remaining after service</dt>
              <dd className="font-bold">{pay ? inr(advanceBreakdown(pricedTotal, pay).remaining) : "—"}</dd>
            </>
          )}
        </dl>
        {!quote && (
          <div className="mt-3 rounded-xl border border-[#0a2540]/10 bg-[#f6f9fc] p-3 text-[13px] text-[#0a2540]/85" aria-label="Before our team arrives">
            <p className="font-bold">Before our team arrives, please arrange:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{CUSTOMER_REQUIREMENTS.slice(0, 4).map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        )}
        <p className="mt-2 text-[11px] text-[#0a2540]/60">By confirming you agree to the scope and please-note points above and our <a href="/terms" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold underline">Terms &amp; Conditions</a>.</p>
        {!ready && !quote && missing.length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-bold">Still needed:</p>
            <ul className="mt-0.5 list-disc pl-4">{missing.map((m) => <li key={m.text}><button type="button" onClick={() => go(m.id)} className="underline-offset-2 hover:underline">{m.text}</button></li>)}</ul>
          </div>
        )}
        {error && <p className="mt-2 text-sm font-semibold text-red-600" role="alert">{error}</p>}
        <button type="button" onClick={submit} disabled={!ready || pending} className="mt-3 min-h-12 w-full rounded-xl bg-primary py-3.5 text-base font-bold text-white disabled:opacity-50">
          {pending ? "Sending…" : inspection ? "Request Site Inspection" : !quote && pricedTotal === 0 ? "Request Quote" : "Confirm Booking Request"}
        </button>
        <p className="mt-2 text-center text-xs text-[#0a2540]/60">Your booking is confirmed only after our team verifies the slot.</p>
      </div>
      )}

      {/* Mobile sticky progress bar — sits above the site's Call / WhatsApp / Book Now bar. */}
      {showSticky && (
        <div className="fixed inset-x-0 bottom-[44px] z-40 border-t border-[#0a2540]/10 bg-white/95 px-4 py-2 shadow-[0_-4px_12px_rgba(10,37,64,0.08)] backdrop-blur sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] text-[#0a2540]/60">{lines.map((l) => l.label).join(", ")}</p>
              <p className="text-base font-extrabold text-primary">{pricedTotal > 0 ? inr(pricedTotal) : "After inspection"}</p>
            </div>
            {ready ? (
              <button type="button" onClick={submit} disabled={pending} className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">{pending ? "Sending…" : "Confirm"}</button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (serviceChosen && !svcDone) {
                    setSvcDone(true);
                    setTimeout(() => go("bk-date"), 50);
                  } else go(nextStep);
                }}
                className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"
              >
                {serviceChosen && !svcDone ? "Continue" : nextStep === "bk-service" ? "Finish selection" : nextStep === "bk-date" ? "Pick date & time" : nextStep === "bk-details" ? "Add details" : nextStep === "bk-pay" ? "Choose payment" : "Review"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const DAY_STYLE: Record<DayStatus, string> = {
  AVAILABLE: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-500",
  FILLING: "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-500",
  FULL: "cursor-not-allowed border-transparent bg-[#0a2540]/5 text-[#0a2540]/30 line-through",
};

/** Month calendar coloured by CRM team capacity: Available / Filling Fast / Fully Booked. */
function BookingCalendar({
  dates,
  value,
  onChange,
  monthOffset,
  setMonthOffset,
}: {
  dates: { date: string; available: boolean; status: DayStatus }[];
  value: string;
  onChange: (d: string) => void;
  monthOffset: number;
  setMonthOffset: (n: number) => void;
}) {
  const byDate = new Map(dates.map((d) => [d.date, d]));
  const first = dates[0]?.date ?? todayIST();
  const last = dates[dates.length - 1]?.date ?? first;
  const [y0, m0] = first.split("-").map(Number);
  const [y1, m1] = last.split("-").map(Number);
  const maxOffset = (y1 - y0) * 12 + (m1 - m0);
  const year = y0 + Math.floor((m0 - 1 + monthOffset) / 12);
  const month = ((m0 - 1 + monthOffset) % 12) + 1;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const pad = (n: number) => String(n).padStart(2, "0");
  const title = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <button type="button" disabled={monthOffset <= 0} onClick={() => setMonthOffset(monthOffset - 1)} className="size-8 rounded-full border text-lg disabled:opacity-30" aria-label="Previous month">‹</button>
        <p className="text-sm font-bold">{title}</p>
        <button type="button" disabled={monthOffset >= maxOffset} onClick={() => setMonthOffset(monthOffset + 1)} className="size-8 rounded-full border text-lg disabled:opacity-30" aria-label="Next month">›</button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#0a2540]/50">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const iso = `${year}-${pad(month)}-${pad(i + 1)}`;
          const d = byDate.get(iso);
          if (!d) return <span key={iso} className="flex h-10 items-center justify-center rounded-lg text-xs text-[#0a2540]/20">{i + 1}</span>;
          const selected = value === iso;
          return (
            <button
              key={iso}
              type="button"
              disabled={!d.available}
              onClick={() => onChange(iso)}
              aria-label={`${iso} ${d.status === "FULL" ? "fully booked" : d.status === "FILLING" ? "filling fast" : "available"}`}
              className={`h-10 rounded-lg border text-sm font-bold ${selected ? "border-primary bg-primary text-white" : DAY_STYLE[d.status]}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#0a2540]/70">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-emerald-400" /> Available</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-amber-400" /> Filling Fast</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#0a2540]/20" /> Fully Booked</span>
      </div>
    </div>
  );
}

