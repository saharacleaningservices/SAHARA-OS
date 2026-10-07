"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Building2, Bug, Check, CheckCircle2, ChevronDown, Clock, Home, Loader2, LocateFixed, Paintbrush, Wallet, X } from "lucide-react";
import { publicBookLead } from "@/server/actions/public-booking";
import { getDateAvailability, getSlotAvailability, type DayStatus } from "@/server/actions/slot-availability";
import { getAttributionPayload } from "@/components/public/attribution-capture";
import { trackLead } from "@/components/public/marketing-tags";
import { inr, EQUIPMENT, OFFICE_SCOPE, PAINT_SCOPE, PEST_SERVICES, TERMS } from "@/lib/marketing-content";
import { CUSTOMER_REQUIREMENTS, HOME_DURATION, homeHighlights, homePleaseNote, homeScopeByArea, smallServiceNotes, type HomeTier } from "@/lib/service-scope";
import { BOOKING_TERMS, PRICING_MASTER, festivalForDate, inGroup, priceLabel, unitPriceFor, upcomingFestivals, type LivePricing, type PriceItem, type PriceType } from "@/lib/pricing-master";

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
const BHKS = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Villa", "Bungalow", "Commercial/Office", "Other"];
const HOME_PACKAGES = ["Premium", "Platinum", "Diamond", "Unfurnished"] as const;
const isTier = (v: string): v is HomeTier => v === "Premium" || v === "Platinum";
const PEST_SIZES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK+", "Villa / Bungalow", "Commercial"];
const PAINT_PROPERTIES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK+", "Villa / Bungalow", "Office / Shop"];
const PAINT_JOBS = ["Fresh Painting", "Repainting"];
const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const shortDay = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

const card = "rounded-2xl bg-white p-4 shadow-sm sm:p-5";
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
  campaignName,
  referralCode,
  prefill,
  preset,
  pricing,
}: {
  quote?: QuotePrefill | null;
  defaultCategory?: Category;
  /** Package pages open with the full-house package already chosen. */
  preset?: { bhk: string; pkg: HomeTier };
  campaignName?: string;
  referralCode?: string;
  prefill?: { name?: string; mobile?: string };
  /** Live prices + festival offers (server/pricing.ts). Falls back to the catalogue. */
  pricing?: LivePricing;
}) {
  // Live catalogue (Super Admin → Pricing & Packages).
  const items = pricing?.items ?? PRICING_MASTER;
  const { CUSTOMISED, COMBOS, ADDON_COMBOS, PACKAGE_COMBOS, PAINTS, PUTTY, PEST_ITEMS, COMMERCIAL_ITEMS } = useMemo(() => {
    const combos = inGroup(items, "COMBO");
    return {
      CUSTOMISED: inGroup(items, "CUSTOMISED"),
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
  useEffect(() => {
    if (festivals.length && /[?&]price=festival/i.test(window.location.search)) setPriceMode("FESTIVAL");
  }, [festivals.length]);
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
  const [sqft, setSqft] = useState("");
  const [putty, setPutty] = useState(false);
  // Schedule / details
  const [dates, setDates] = useState<{ date: string; available: boolean; status: DayStatus }[] | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ slot: string; available: boolean }[] | null>(null);
  const [slot, setSlot] = useState("");
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
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
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
    if (category === "COMMERCIAL" && comType) out.push({ label: `${comType} Cleaning${area ? ` · ${area} sq ft` : ""}`, amount: null, note: "Price after inspection" });
    if (category === "PEST" && pest) out.push({ label: `${pest}${pestSize ? ` · ${pestSize}` : ""}`, amount: null, note: "Price after inspection" });
    if (category === "PAINTING" && paint) {
      const item = PAINTS.find((p) => p.contentId === paint)!;
      const s = Number(sqft) || 0;
      const rate = item.price == null ? null : item.price + (putty && PUTTY?.price ? PUTTY.price : 0);
      out.push({
        label: `${paintJob ? `${paintJob} · ` : ""}${item.name}${paintProperty ? ` · ${paintProperty}` : ""}${s ? ` · ${s} sq ft` : ""}${putty ? " + putty" : ""}`,
        amount: rate != null && s > 0 ? rate * s : null,
        note: rate == null ? "Price after inspection" : s > 0 ? "Estimate — final after site measurement" : "Enter area for an estimate",
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, category, homeType, bhk, pkg, qty, combos, comType, area, pest, pestSize, paint, paintProperty, paintJob, sqft, putty, items, activeFestival]);

  const pricedTotal = quote ? quote.totalAmount : lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  const hasUnpriced = !quote && lines.some((l) => l.amount == null);
  const addOnOnlyAlone = !quote && lines.length > 0 && lines.every((l) => COMBOS.find((c) => c.name === l.label)?.addOnOnly);
  const needsPriceMode = festivalApplies && category === "HOME";
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
      (category !== "PAINTING" || (!!paintProperty && !!paintJob && (Number(sqft) > 0 || PAINTS.find((p) => p.contentId === paint)?.price == null)));
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
      return it ? [{ contentId: it.contentId, qty: 1 }] : [];
    }
    return [
      ...(homeType === "CUSTOM" ? CUSTOMISED.filter((it) => (qty[it.contentId] ?? 0) > 0).map((it) => ({ contentId: it.contentId, qty: qty[it.contentId] })) : []),
      ...(homeType === "COMBO" ? PACKAGE_COMBOS : ADDON_COMBOS).filter((c) => combos[c.contentId]).map((c) => ({ contentId: c.contentId, qty: 1 })),
    ];
  }

  function submit() {
    setError("");
    if (!ready) return setError("Please complete all steps.");
    const summary = lines.map((l) => `${l.label}${l.amount != null ? ` = ${inr(l.amount)}` : l.note ? ` (${l.note})` : ""}`).join("; ");
    startTransition(async () => {
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
        // Price snapshot — the server re-prices these items and freezes the amount on the lead.
        priceType: category === "HOME" && !quote ? (priceMode === "FESTIVAL" ? "FESTIVAL" : "REGULAR") : undefined,
        selectedItems: quote ? [] : selectedItems(),
        estimatedAmount: pricedTotal > 0 ? pricedTotal : undefined,
        serviceDate: date,
        timeSlot: slot,
        paymentPreference: pay || undefined,
        marketingOptIn: false,
        quotationToken: quote?.token ?? "",
        referralCode: referralCode ?? "",
        notes: quote ? `Quotation ${quote.quoteNumber}` : `${campaignName ? `${campaignName} — ` : "Booking page — "}${summary}`,
        source: "WEBSITE",
        attribution: getAttributionPayload(),
      });
      if ("error" in res && res.error) return setError(res.error);
      trackLead({ category: m.serviceCategory, variant: m.serviceVariant });
      setDone("leadNumber" in res ? (res.leadNumber ?? "") : "");
    });
  }

  if (done !== null) {
    return (
      <div id="bk-done" ref={(el) => el?.scrollIntoView({ behavior: "smooth", block: "center" })} className={`${card} scroll-mt-20 text-center`}>
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <h3 className="mt-2 text-xl font-bold">Booking request received</h3>
        <p className="mt-1 text-sm text-[#0a2540]/75">Reference: <span className="font-semibold">{done}</span></p>
        <p className="mt-2 text-sm text-[#0a2540]/75">{fmtDay(date)} · {slot}</p>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          This is not yet a confirmed booking. Our team will confirm your slot shortly — you&apos;ll receive the confirmation with your booking link on WhatsApp.
        </p>
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
  const section = (key: Category, icon: React.ReactNode, title: string, hint: string, body: React.ReactNode) => (
    <div className={`rounded-2xl border ${category === key ? "border-primary/40 bg-primary/[0.03]" : "border-[#0a2540]/10 bg-white"}`}>
      <button type="button" onClick={() => setCategory(category === key ? "" : key)} className="flex min-h-14 w-full items-center gap-3 p-3.5 text-left sm:p-4" aria-expanded={category === key}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <span className="flex-1">
          <span className="block font-bold">{title}</span>
          <span className="block text-xs text-[#0a2540]/60">{hint}</span>
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
        ? ["Final price is confirmed after site measurement.", "Number of coats depends on site condition and the selected finish."]
        : ["Price is confirmed after inspection / requirement assessment.", "Additional work outside the agreed scope may be chargeable."];
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const nextStep = !serviceChosen ? "bk-service" : !date || !slot ? "bk-date" : !quote && !detailsOk ? "bk-details" : !pay ? "bk-pay" : "bk-summary";
  const showSticky = !quote && lines.length > 0 && !pastSummary;

  return (
    <div className="space-y-3 sm:space-y-4">
      {quote ? (
        <div className={card}>
          {step(1, "Your quotation", true)}
          <p className="mt-2 text-sm">Quotation <span className="font-semibold">{quote.quoteNumber}</span> · {quote.customerName}</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-[#0a2540]/80">{quote.services.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="mt-2 text-xl font-extrabold text-primary">{inr(quote.totalAmount)}</p>
        </div>
      ) : (
        <div id="bk-service" className={`${card} scroll-mt-20`}>
          {step(1, "Choose service & package", serviceChosen)}
          <div className="mt-3 space-y-2.5">
            {section("HOME", <Home className="size-5" />, "Home Cleaning", "Full house · Customized · Combo", (
              <>
                {needsPriceMode && (
                  <div>
                    <p className="mb-2 text-sm font-semibold">Festival or regular booking?</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => { setPriceMode("FESTIVAL"); if (date && !festivalForDate(festivals, date)) setDate(""); }} className={`${chip(priceMode === "FESTIVAL")} text-left leading-tight`}>
                        🪔 Festival Special
                        <span className={`block text-[11px] font-medium ${priceMode === "FESTIVAL" ? "text-white/85" : "text-[#0a2540]/60"}`}>
                          {festivals.map((f) => `${f.name} ${shortDay(f.start)}–${shortDay(f.end)}`).join(" · ")}
                        </span>
                      </button>
                      <button type="button" onClick={() => { setPriceMode("REGULAR"); if (date && festivalForDate(festivals, date)) setDate(""); }} className={`${chip(priceMode === "REGULAR")} text-left leading-tight`}>
                        Regular
                        <span className={`block text-[11px] font-medium ${priceMode === "REGULAR" ? "text-white/85" : "text-[#0a2540]/60"}`}>Service on a date outside festival dates</span>
                      </button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["FULL", "Full House"],
                    ["CUSTOM", "Customized"],
                    ["COMBO", "Combo"],
                  ] as const).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => setHomeType(v)} className={`${chip(homeType === v)} whitespace-nowrap px-1.5 text-[13px]`}>{t}</button>
                  ))}
                </div>
                {homeType === "FULL" && (
                  <>
                    <div>
                      <p className="mb-2 text-sm font-semibold">Property type</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{BHKS.map((b) => <button key={b} type="button" onClick={() => setBhk(b)} className={`${chip(bhk === b)} whitespace-nowrap px-1 text-[13px]`}>{b}</button>)}</div>
                    </div>
                    {bhk && (
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {HOME_PACKAGES.map((t) => {
                          const it = isTier(t) ? pkgPrice(t) : undefined;
                          const on = pkg === t;
                          return (
                            <button key={t} type="button" onClick={() => setPkg(t)} className={`rounded-2xl border p-3.5 text-left ${on ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-[#0a2540]/15 bg-white"}`}>
                              <span className="flex items-start justify-between gap-2">
                                <span>
                                  <span className="block text-base font-bold">{bhk} {t}</span>
                                  <span className="block text-[11px] font-semibold text-[#0a2540]/55">{HOME_DURATION}</span>
                                </span>
                                {it ? (
                                  <PackagePrice item={it} festivalPrice={festivalApplies ? festivalPriceOf(it) : null} festivalOn={priceMode === "FESTIVAL"} />
                                ) : (
                                  <span className="text-right text-[11px] font-semibold text-[#0a2540]/60">Price on confirmation</span>
                                )}
                              </span>
                              <span className="mt-2 block space-y-0.5 text-xs text-[#0a2540]/75">
                                {isTier(t) && homeHighlights(t).slice(0, 3).map((h) => <span key={h} className="flex gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />{h}</span>)}
                              </span>
                              <span className={`mt-2.5 block rounded-lg py-1.5 text-center text-xs font-bold ${on ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>{on ? "Selected" : "Select"}</span>
                            </button>
                          );
                        })}
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
            ))}
            {section("COMMERCIAL", <Building2 className="size-5" />, "Commercial Cleaning", "Office · Shop · Warehouse · Clinic", (
              <>
                <div className="flex flex-wrap gap-2">{COMMERCIAL_ITEMS.map((c) => <button key={c.contentId} type="button" onClick={() => setComType(c.variant)} className={chip(comType === c.variant)}>{c.variant}</button>)}</div>
                <input className={input} inputMode="numeric" placeholder="Approximate area (sq ft)" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, ""))} />
                <p className="text-sm font-semibold text-primary">Inspection-based pricing</p>
              </>
            ))}
            {section("PEST", <Bug className="size-5" />, "Pest Control", "Cockroach · Termite · Bed bug · Ant", (
              <>
                <div>
                  <p className="mb-2 text-sm font-semibold">Pest type</p>
                  <div className="flex flex-wrap gap-2">{PEST_ITEMS.map((p) => <button key={p.contentId} type="button" onClick={() => setPest(p.name)} className={chip(pest === p.name)}>{p.name}</button>)}</div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">Property type</p>
                  <div className="flex flex-wrap gap-2">{PEST_SIZES.map((s) => <button key={s} type="button" onClick={() => setPestSize(s)} className={chip(pestSize === s)}>{s}</button>)}</div>
                </div>
                <p className="text-sm font-semibold text-primary">Inspection-based pricing</p>
              </>
            ))}
            {section("PAINTING", <Paintbrush className="size-5" />, "Interior Painting", "Per sq ft · Asian Paints range", (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PAINTS.map((p) => (
                    <button key={p.contentId} type="button" onClick={() => setPaint(p.contentId)} className={`rounded-xl border p-3 text-left text-sm ${paint === p.contentId ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-[#0a2540]/15 bg-white"}`}>
                      <span className="block font-semibold">{p.name}</span>
                      <span className="block text-xs text-primary">{priceLabel(p)}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">Property</p>
                  <div className="flex flex-wrap gap-2">{PAINT_PROPERTIES.map((s) => <button key={s} type="button" onClick={() => setPaintProperty(s)} className={chip(paintProperty === s)}>{s}</button>)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">{PAINT_JOBS.map((s) => <button key={s} type="button" onClick={() => setPaintJob(s)} className={chip(paintJob === s)}>{s}</button>)}</div>
                <input className={input} inputMode="numeric" placeholder="Paintable area (sq ft)" value={sqft} onChange={(e) => setSqft(e.target.value.replace(/\D/g, ""))} />
                {PUTTY && (
                  <label className="flex min-h-11 items-center gap-2.5 text-sm">
                    <input type="checkbox" className="size-5" checked={putty} onChange={(e) => setPutty(e.target.checked)} /> Add putty ({priceLabel(PUTTY)})
                  </label>
                )}
              </>
            ))}
          </div>
        </div>
      )}

      {/* Package details: price → highlights → full scope → please note → terms */}
      {!quote && lines.length > 0 && (
        <div className={card}>
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
                ? `Festival Special price${activeFestival ? ` (${activeFestival.name})` : ""} — for service dates during the festival. Festival slots are subject to team availability.`
                : "Regular price — for service dates outside the festival dates."}
            </p>
          )}
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-900">{PRICE_NOTE}</p>

          {tier && (
            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              {homeHighlights(tier).map((h) => <li key={h} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{h}</li>)}
            </ul>
          )}

          <div className="mt-3 divide-y divide-[#0a2540]/10 overflow-hidden rounded-xl border border-[#0a2540]/10">
            <details className="group bg-white" open={!!tier}>
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

      <div id="bk-date" className={`${card} scroll-mt-20`}>
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

      {!quote && (
        <div id="bk-details" className={`${card} scroll-mt-20`}>
          {step(4, "Your details", name.trim().length >= 2 && /^\d{10}$/.test(mobile.replace(/\D/g, "").slice(-10)))}
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <input className={input} autoComplete="name" placeholder="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={input} autoComplete="tel" type="tel" placeholder="Mobile number *" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            <input className={input} type="tel" placeholder="Alternate mobile (optional)" inputMode="numeric" value={altMobile} onChange={(e) => setAltMobile(e.target.value)} />
            <input className={input} autoComplete="email" placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
      )}

      {!quote && (
        <div id="bk-address" className={`${card} scroll-mt-20`}>
          {step(5, "Service address", address.trim().length >= 5)}
          <textarea className={`${input} mt-3 h-24 py-2.5`} autoComplete="street-address" placeholder="Full address * (flat, building / society, area, landmark)" value={address} onChange={(e) => setAddress(e.target.value)} />
          <input className={`${input} mt-2`} autoComplete="postal-code" placeholder="PIN code (6 digits)" inputMode="numeric" maxLength={6} value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))} />
          <button
            type="button"
            onClick={useCurrentLocation}
            className={`mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${mapLink ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-primary/40 text-primary"}`}
          >
            {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
            {mapLink ? "Google Maps location added ✓" : "Add Google Maps location (optional)"}
          </button>
        </div>
      )}

      <div id="bk-pay" className={`${card} scroll-mt-20`}>
        {step(quote ? 3 : 6, "Payment *", !!pay)}
        <div className="mt-3 grid grid-cols-2 gap-2">
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

      <div id="bk-summary" className={`${card} scroll-mt-20 border-2 border-primary/20`}>
        <h3 className="text-base font-bold sm:text-lg">Booking summary</h3>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-[#0a2540]/60">Service</dt>
          <dd className="font-medium">{lines.length ? lines.map((l) => l.label).join(", ") : quote ? quote.services.join(", ") : "—"}</dd>
          {tier && (
            <>
              <dt className="text-[#0a2540]/60">Scope</dt>
              <dd className="font-medium">{tier === "Platinum" ? "Wall wet cleaning + ceiling dry dusting" : "Wall dry dusting + ceiling dry dusting"} · {HOME_DURATION}</dd>
            </>
          )}
          {needsPriceMode && priceMode && (
            <>
              <dt className="text-[#0a2540]/60">Price</dt>
              <dd className="font-medium">{priceMode === "FESTIVAL" ? `Festival Special${activeFestival ? ` · ${activeFestival.name}` : ""}` : "Regular"}</dd>
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
        </dl>
        <p className="mt-2 text-[11px] text-[#0a2540]/60">By confirming you agree to the scope, please-note points and terms shown above.</p>
        {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
        <button type="button" onClick={submit} disabled={!ready || pending} className="mt-3 min-h-12 w-full rounded-xl bg-primary py-3.5 text-base font-bold text-white disabled:opacity-50">
          {pending ? "Sending…" : "Confirm Booking Request"}
        </button>
        <p className="mt-2 text-center text-xs text-[#0a2540]/60">Your booking is confirmed only after our team verifies the slot.</p>
      </div>

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
              <button type="button" onClick={() => go(nextStep)} className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">
                {nextStep === "bk-service" ? "Finish selection" : nextStep === "bk-date" ? "Pick date & time" : nextStep === "bk-details" ? "Add details" : nextStep === "bk-pay" ? "Choose payment" : "Review"}
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
  const first = dates[0]?.date ?? new Date().toISOString().slice(0, 10);
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

/** Package card price: regular only, or Regular + Festival Special side by side. */
function PackagePrice({ item, festivalPrice, festivalOn }: { item: PriceItem; festivalPrice: number | null; festivalOn: boolean }) {
  if (festivalPrice == null) {
    return (
      <span className="text-right">
        <span className="block text-lg font-extrabold text-primary">{inr(item.price!)}</span>
        {item.mrp && <span className="block text-[11px] text-[#0a2540]/45 line-through">{inr(item.mrp)}</span>}
      </span>
    );
  }
  return (
    <span className="text-right text-[11px] leading-tight">
      <span className={`block ${festivalOn ? "text-[#0a2540]/50" : "font-semibold"}`}>
        Regular <span className={`text-sm font-extrabold ${festivalOn ? "" : "text-primary"}`}>{inr(item.price!)}</span>
      </span>
      <span className={`mt-0.5 block ${festivalOn ? "font-semibold text-amber-800" : "text-[#0a2540]/50"}`}>
        Festival Special <span className={`text-sm font-extrabold ${festivalOn ? "text-amber-700" : ""}`}>{inr(festivalPrice)}</span>
      </span>
    </span>
  );
}
