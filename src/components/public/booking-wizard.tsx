"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Building2, Bug, CalendarDays, CheckCircle2, ChevronDown, Clock, Home, Loader2, Paintbrush, Wallet } from "lucide-react";
import { publicBookLead } from "@/server/actions/public-booking";
import { getDateAvailability, getSlotAvailability } from "@/server/actions/slot-availability";
import { getAttributionPayload } from "@/components/public/attribution-capture";
import { trackLead } from "@/components/public/marketing-tags";
import { inr } from "@/lib/marketing-content";
import { PRICING_MASTER, PRICING_NOTICE, SERVICE_AREA_NOTICE, pricesIn, priceLabel, type PriceItem } from "@/lib/pricing-master";

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

const BHKS = ["1 BHK", "2 BHK", "3 BHK", "4 BHK"];
const PEST_SIZES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK+", "Villa / Bungalow", "Commercial"];
const CUSTOMISED = pricesIn("CUSTOMISED");
const COMBOS = pricesIn("COMBO");
const PAINTS = pricesIn("PAINTING").filter((p) => !p.addOnOnly);
const PUTTY = PRICING_MASTER.find((p) => p.contentId === "SCS-PUTTY") ?? null;

const card = "rounded-2xl bg-white p-5 shadow-sm";
const input = "h-11 w-full rounded-xl border border-[#0a2540]/15 bg-white px-3 text-sm outline-none focus:border-primary";
const chip = (on: boolean) =>
  `rounded-xl border px-3 py-2 text-sm font-semibold transition ${on ? "border-primary bg-primary text-white" : "border-[#0a2540]/15 bg-white hover:border-primary/50"}`;
const fmtDay = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function Stepper({ value, min, onChange }: { value: number; min: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Decrease" onClick={() => onChange(value <= min ? 0 : value - 1)} className="size-9 rounded-full border text-lg font-bold">−</button>
      <span className="w-7 text-center font-bold">{value}</span>
      <button type="button" aria-label="Increase" onClick={() => onChange(value === 0 ? min : value + 1)} className="size-9 rounded-full border text-lg font-bold">+</button>
    </div>
  );
}

export function BookingWizard({
  quote,
  defaultCategory,
  campaignName,
  referralCode,
  prefill,
}: {
  quote?: QuotePrefill | null;
  defaultCategory?: Category;
  campaignName?: string;
  referralCode?: string;
  prefill?: { name?: string; mobile?: string };
}) {
  const [category, setCategory] = useState<Category | "">(defaultCategory ?? "");
  // Home
  const [bhk, setBhk] = useState("");
  const [pkg, setPkg] = useState<"Premium" | "Platinum" | "Customised" | "">("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [combos, setCombos] = useState<Record<string, boolean>>({});
  // Commercial / Pest / Painting
  const [comType, setComType] = useState("");
  const [area, setArea] = useState("");
  const [pest, setPest] = useState("");
  const [pestSize, setPestSize] = useState("");
  const [paint, setPaint] = useState("");
  const [sqft, setSqft] = useState("");
  const [putty, setPutty] = useState(false);
  // Schedule / details
  const [dates, setDates] = useState<{ date: string; available: boolean }[] | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ slot: string; available: boolean }[] | null>(null);
  const [slot, setSlot] = useState("");
  const [name, setName] = useState(quote?.customerName ?? prefill?.name ?? "");
  const [mobile, setMobile] = useState(quote?.mobile ?? prefill?.mobile ?? "");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [pay, setPay] = useState<"PAY_ADVANCE" | "PAY_AFTER_SERVICE" | "">("");
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getDateAvailability(21).then(setDates).catch(() => setDates([]));
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
    if (category === "HOME" && bhk && (pkg === "Premium" || pkg === "Platinum")) {
      const item = PRICING_MASTER.find((p) => p.bhk === bhk && p.variant === pkg);
      if (item) out.push({ label: `${bhk} ${pkg} Deep Cleaning`, amount: item.price });
    }
    if (category === "HOME" && pkg === "Customised") {
      for (const it of CUSTOMISED) {
        const n = qty[it.contentId] ?? 0;
        if (n > 0) out.push({ label: `${it.name} × ${n}`, amount: it.price == null ? null : it.price * n, note: it.price == null ? it.priceNote : undefined });
      }
      for (const c of COMBOS) if (combos[c.contentId]) out.push({ label: c.name, amount: c.price });
    }
    if (category === "COMMERCIAL" && comType) out.push({ label: `${comType} Cleaning${area ? ` · ${area} sq ft` : ""}`, amount: null, note: "Price after inspection / requirement assessment" });
    if (category === "PEST" && pest) out.push({ label: `${pest}${pestSize ? ` · ${pestSize}` : ""}`, amount: null, note: "Price after inspection" });
    if (category === "PAINTING" && paint) {
      const item = PAINTS.find((p) => p.contentId === paint)!;
      const s = Number(sqft) || 0;
      const rate = item.price == null ? null : item.price + (putty && PUTTY?.price ? PUTTY.price : 0);
      out.push({
        label: `${item.name}${s ? ` · ${s} sq ft` : ""}${putty ? " + putty" : ""}`,
        amount: rate != null && s > 0 ? rate * s : null,
        note: rate == null ? "Price after inspection" : s > 0 ? "Estimate — final after site measurement" : "Enter area for an estimate",
      });
    }
    return out;
  }, [quote, category, bhk, pkg, qty, combos, comType, area, pest, pestSize, paint, sqft, putty]);

  const pricedTotal = quote ? quote.totalAmount : lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  const hasUnpriced = !quote && lines.some((l) => l.amount == null);
  const addOnOnlyAlone = !quote && lines.length > 0 && lines.every((l) => COMBOS.find((c) => c.name === l.label)?.addOnOnly);
  const serviceChosen = quote ? true : lines.length > 0 && !addOnOnlyAlone && (category !== "PAINTING" || Number(sqft) > 0 || PAINTS.find((p) => p.contentId === paint)?.price == null);
  const detailsOk = quote || (name.trim().length >= 2 && /^\d{10}$/.test(mobile.replace(/\D/g, "").slice(-10)) && location.trim());
  const ready = serviceChosen && date && slot && pay && detailsOk;

  function mapping() {
    if (category === "HOME" && (pkg === "Premium" || pkg === "Platinum")) {
      return { serviceCategory: "HOME_DEEP_CLEANING", serviceVariant: pkg, packageName: `${bhk} ${pkg}`, propertyType: bhk };
    }
    if (category === "HOME") {
      const first = CUSTOMISED.find((it) => (qty[it.contentId] ?? 0) > 0);
      return { serviceCategory: first ? "INDIVIDUAL_CLEANING" : "COMBO_PACKAGE", serviceVariant: first?.variant ?? "", packageName: "", propertyType: bhk };
    }
    if (category === "COMMERCIAL") return { serviceCategory: "COMMERCIAL_CLEANING", serviceVariant: comType, packageName: "", propertyType: comType };
    if (category === "PEST") return { serviceCategory: "PEST_CONTROL", serviceVariant: pest, packageName: "", propertyType: pestSize };
    const item = PAINTS.find((p) => p.contentId === paint);
    return { serviceCategory: "PAINTING", serviceVariant: item?.variant ?? "", packageName: "", propertyType: "" };
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
        area: location.trim(),
        address: address.trim(),
        ...m,
        comboServices: COMBOS.filter((c) => combos[c.contentId]).map((c) => c.name),
        estimatedAmount: pricedTotal > 0 ? pricedTotal : undefined,
        serviceDate: date,
        timeSlot: slot,
        paymentPreference: pay || undefined,
        marketingOptIn: optIn,
        quotationToken: quote?.token ?? "",
        referralCode: referralCode ?? "",
        notes: [quote ? `Quotation ${quote.quoteNumber}` : `${campaignName ? `${campaignName} — ` : "Booking page — "}${summary}`, notes.trim()].filter(Boolean).join(" · "),
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
      <div className={`${card} text-center`}>
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

  const step = (n: number, title: string) => (
    <h3 className="flex items-center gap-2 text-lg font-bold">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-white">{n}</span>
      {title}
    </h3>
  );
  const section = (key: Category, icon: React.ReactNode, title: string, hint: string, body: React.ReactNode) => (
    <div className={`rounded-2xl border ${category === key ? "border-primary/40 bg-primary/[0.03]" : "border-[#0a2540]/10 bg-white"}`}>
      <button type="button" onClick={() => setCategory(category === key ? "" : key)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={category === key}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <span className="flex-1">
          <span className="block font-bold">{title}</span>
          <span className="block text-xs text-[#0a2540]/60">{hint}</span>
        </span>
        <ChevronDown className={`size-5 transition ${category === key ? "rotate-180" : ""}`} />
      </button>
      {category === key && <div className="space-y-4 border-t border-[#0a2540]/10 p-4">{body}</div>}
    </div>
  );
  const pkgPrice = (tier: "Premium" | "Platinum") => PRICING_MASTER.find((p) => p.bhk === bhk && p.variant === tier);

  return (
    <div className="space-y-4">
      {quote ? (
        <div className={card}>
          {step(1, "Your quotation")}
          <p className="mt-2 text-sm">Quotation <span className="font-semibold">{quote.quoteNumber}</span> · {quote.customerName}</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-[#0a2540]/80">{quote.services.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="mt-2 text-xl font-extrabold text-primary">{inr(quote.totalAmount)}</p>
        </div>
      ) : (
        <div className={card}>
          {step(1, "Choose your service")}
          <div className="mt-3 space-y-3">
            {section("HOME", <Home className="size-5" />, "Home Cleaning", "Premium · Platinum · Customised cleaning", (
              <>
                <div>
                  <p className="mb-2 text-sm font-semibold">Property size</p>
                  <div className="flex flex-wrap gap-2">{BHKS.map((b) => <button key={b} type="button" onClick={() => setBhk(b)} className={chip(bhk === b)}>{b}</button>)}</div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">Package</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(["Premium", "Platinum"] as const).map((t) => {
                      const it = pkgPrice(t);
                      return (
                        <button key={t} type="button" onClick={() => setPkg(t)} className={`rounded-xl border p-3 text-left text-sm ${pkg === t ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-[#0a2540]/15 bg-white"}`}>
                          <span className="block font-bold">{t}</span>
                          <span className="block text-xs text-[#0a2540]/65">{t === "Premium" ? "Complete scope · wall & ceiling dry dusting" : "Complete scope · wall wet cleaning · ceiling dry dusting"}</span>
                          {bhk && it ? (
                            <span className="mt-1 block">
                              <span className="text-lg font-extrabold text-primary">{inr(it.price!)}</span>
                              {it.mrp && <span className="ml-1.5 text-xs text-[#0a2540]/45 line-through">{inr(it.mrp)}</span>}
                            </span>
                          ) : (
                            <span className="mt-1 block text-xs text-[#0a2540]/55">Select property size to see price</span>
                          )}
                        </button>
                      );
                    })}
                    <button type="button" onClick={() => setPkg("Customised")} className={`rounded-xl border p-3 text-left text-sm ${pkg === "Customised" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-[#0a2540]/15 bg-white"}`}>
                      <span className="block font-bold">Customised Cleaning</span>
                      <span className="block text-xs text-[#0a2540]/65">Pick individual services by quantity</span>
                    </button>
                  </div>
                </div>
                {pkg === "Customised" && (
                  <div className="space-y-2">
                    {CUSTOMISED.map((it: PriceItem) => (
                      <div key={it.contentId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0a2540]/10 bg-white p-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{it.name}</p>
                          <p className="text-xs text-primary">{priceLabel(it)}</p>
                          {(it.rule || it.scope) && <p className="text-[11px] font-semibold text-amber-700">{[it.rule, it.scope].filter(Boolean).join(" · ")}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <Stepper value={qty[it.contentId] ?? 0} min={it.minQty ?? 1} onChange={(v) => setQty((q) => ({ ...q, [it.contentId]: v }))} />
                          <span className="w-20 text-right text-sm font-bold">{(qty[it.contentId] ?? 0) > 0 && it.price != null ? inr(it.price * qty[it.contentId]) : ""}</span>
                        </div>
                      </div>
                    ))}
                    <p className="pt-2 text-sm font-semibold">Combo packages</p>
                    {COMBOS.map((c) => (
                      <label key={c.contentId} className="flex items-center justify-between gap-2 rounded-xl border border-[#0a2540]/10 bg-white p-3 text-sm">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" className="size-4" checked={!!combos[c.contentId]} onChange={(e) => setCombos((m) => ({ ...m, [c.contentId]: e.target.checked }))} />
                          <span>
                            <span className="font-semibold">{c.name}</span>
                            {c.addOnOnly && <span className="block text-[11px] font-semibold text-amber-700">{c.rule}</span>}
                          </span>
                        </span>
                        <span className="font-bold text-primary">{inr(c.price!)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            ))}
            {section("COMMERCIAL", <Building2 className="size-5" />, "Commercial Cleaning", "Shop · Office · Warehouse · Clinic", (
              <>
                <div className="flex flex-wrap gap-2">{pricesIn("COMMERCIAL").map((c) => <button key={c.contentId} type="button" onClick={() => setComType(c.variant)} className={chip(comType === c.variant)}>{c.variant}</button>)}</div>
                <input className={input} inputMode="numeric" placeholder="Approximate area (sq ft)" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, ""))} />
                <p className="text-sm font-semibold text-primary">Price after inspection / requirement assessment</p>
              </>
            ))}
            {section("PEST", <Bug className="size-5" />, "Pest Control", "Cockroach · Termite · Bed bug · Ant", (
              <>
                <div className="flex flex-wrap gap-2">{pricesIn("PEST").map((p) => <button key={p.contentId} type="button" onClick={() => setPest(p.name)} className={chip(pest === p.name)}>{p.name}</button>)}</div>
                <div className="flex flex-wrap gap-2">{PEST_SIZES.map((s) => <button key={s} type="button" onClick={() => setPestSize(s)} className={chip(pestSize === s)}>{s}</button>)}</div>
                <p className="text-sm font-semibold text-primary">Price after inspection</p>
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
                <input className={input} inputMode="numeric" placeholder="Paintable area (sq ft)" value={sqft} onChange={(e) => setSqft(e.target.value.replace(/\D/g, ""))} />
                {PUTTY && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4" checked={putty} onChange={(e) => setPutty(e.target.checked)} /> Add putty ({priceLabel(PUTTY)})
                  </label>
                )}
                <p className="text-xs text-[#0a2540]/65">Estimate only — the final price is confirmed after site measurement.</p>
              </>
            ))}
          </div>
          {lines.length > 0 && (
            <div className="mt-4 rounded-xl bg-[#0a2540]/[0.03] p-3 text-sm">
              {lines.map((l) => (
                <p key={l.label} className="flex justify-between gap-3">
                  <span>{l.label}</span>
                  <span className="shrink-0 font-semibold">{l.amount != null ? inr(l.amount) : <span className="text-xs text-[#0a2540]/60">{l.note}</span>}</span>
                </p>
              ))}
              {addOnOnlyAlone && <p className="mt-1 text-xs font-semibold text-red-600">This combo is an add-on — please add another service.</p>}
            </div>
          )}
        </div>
      )}

      <div className={card}>
        {step(2, "Pick a date")}
        {!dates ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-[#0a2540]/60"><Loader2 className="size-4 animate-spin" /> Checking availability…</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {dates.map((d) => (
              <button
                key={d.date}
                type="button"
                disabled={!d.available}
                onClick={() => setDate(d.date)}
                className={`rounded-xl border p-2 text-center text-xs font-semibold ${date === d.date ? "border-primary bg-primary text-white" : d.available ? "border-[#0a2540]/10 bg-white hover:border-primary/40" : "cursor-not-allowed border-transparent bg-[#0a2540]/5 text-[#0a2540]/35"}`}
              >
                <CalendarDays className="mx-auto mb-0.5 size-3.5" />
                {fmtDay(d.date)}
                {!d.available && <span className="block text-[10px]">Full</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={card}>
        {step(3, "Pick an available time")}
        {!date ? (
          <p className="mt-2 text-sm text-[#0a2540]/60">Select a date first.</p>
        ) : !slots ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-[#0a2540]/60"><Loader2 className="size-4 animate-spin" /> Loading slots…</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {slots.map((s) => (
              <button
                key={s.slot}
                type="button"
                disabled={!s.available}
                onClick={() => setSlot(s.slot)}
                className={`flex items-center justify-center gap-1 rounded-xl border p-2.5 text-sm font-semibold ${slot === s.slot ? "border-primary bg-primary text-white" : s.available ? "border-[#0a2540]/10 bg-white hover:border-primary/40" : "cursor-not-allowed bg-[#0a2540]/5 text-[#0a2540]/35"}`}
              >
                <Clock className="size-3.5" /> {s.slot}
                {!s.available && <span className="text-[10px]">· Full</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {!quote && (
        <div className={card}>
          {step(4, "Your details")}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input className={input} placeholder="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={input} placeholder="Mobile number *" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            <input className={input} placeholder="Area / society * (e.g. Magarpatta, Wakad)" value={location} onChange={(e) => setLocation(e.target.value)} />
            <input className={input} placeholder="Full address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
            <textarea className={`${input} h-20 py-2 sm:col-span-2`} placeholder="Anything we should know? (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      )}

      <div className={card}>
        {step(quote ? 4 : 5, "Payment preference")}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {([
            ["PAY_ADVANCE", "Pay Advance", "Secure your slot with an advance — payment details are on your booking page."],
            ["PAY_AFTER_SERVICE", "Pay After Service", "Pay once the service is completed, as per Sahara's booking terms."],
          ] as const).map(([v, t, d]) => (
            <button key={v} type="button" onClick={() => setPay(v)} className={`rounded-xl border p-3 text-left text-sm ${pay === v ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-[#0a2540]/10"}`}>
              <span className="flex items-center gap-1.5 font-semibold"><Wallet className="size-4 text-primary" /> {t}</span>
              <span className="mt-0.5 block text-xs text-[#0a2540]/70">{d}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`${card} border-2 border-primary/20`}>
        <h3 className="text-lg font-bold">Booking summary</h3>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[#0a2540]/60">Service</dt>
          <dd className="font-medium">{lines.length ? lines.map((l) => l.label).join(", ") : "—"}</dd>
          <dt className="text-[#0a2540]/60">Date</dt>
          <dd className="font-medium">{date ? fmtDay(date) : "—"}</dd>
          <dt className="text-[#0a2540]/60">Time</dt>
          <dd className="font-medium">{slot || "—"}</dd>
          <dt className="text-[#0a2540]/60">Payment</dt>
          <dd className="font-medium">{pay === "PAY_ADVANCE" ? "Pay advance" : pay === "PAY_AFTER_SERVICE" ? "Pay after service" : "—"}</dd>
          <dt className="text-[#0a2540]/60">{quote ? "Quoted amount" : "Total"}</dt>
          <dd className="font-extrabold text-primary">
            {pricedTotal > 0 ? inr(pricedTotal) : lines.length ? "After inspection" : "—"}
            {hasUnpriced && pricedTotal > 0 && <span className="ml-1 text-xs font-medium text-[#0a2540]/60">+ items priced before booking</span>}
          </dd>
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-[#0a2540]/60">{PRICING_NOTICE}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#0a2540]/60">{SERVICE_AREA_NOTICE}</p>
        <label className="mt-3 flex items-start gap-2 text-xs text-[#0a2540]/75">
          <input type="checkbox" className="mt-0.5 size-4" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          Send me festival offers and cleaning reminders on WhatsApp (optional — you can reply STOP any time).
        </label>
        {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
        <button type="button" onClick={submit} disabled={!ready || pending} className="mt-3 w-full rounded-xl bg-primary py-3.5 text-base font-bold text-white disabled:opacity-50">
          {pending ? "Sending…" : "Confirm Booking Request"}
        </button>
        <p className="mt-2 text-center text-xs text-[#0a2540]/60">Your booking is confirmed only after our team verifies the slot.</p>
      </div>
    </div>
  );
}
