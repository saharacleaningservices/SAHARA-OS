"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, CheckCircle2, Clock, Loader2, Wallet } from "lucide-react";
import { publicBookLead } from "@/server/actions/public-booking";
import { getDateAvailability, getSlotAvailability } from "@/server/actions/slot-availability";
import { getAttributionPayload } from "@/components/public/attribution-capture";
import { trackLead } from "@/components/public/marketing-tags";
import { inr } from "@/lib/marketing-content";
import { PRICE_GROUP_LABEL, PRICING_MASTER } from "@/lib/pricing-master";

// Customer booking flow in the approved landing-page design. Prices come only
// from marketing-content.ts (the approved catalogue prices). Submitting sends
// a BOOKING REQUEST through publicBookLead — the booking is confirmed only
// when the office confirms it in the CRM.

export type QuotePrefill = {
  token: string;
  quoteNumber: string;
  customerName: string;
  mobile: string;
  services: string[];
  totalAmount: number;
};

type Choice = {
  key: string;
  group: string;
  label: string;
  category: string;
  variant: string;
  packageName?: string;
  propertyType?: string;
  unitPrice: number | null; // null = price after inspection
  unit?: string;
  minQty?: number;
};

// Every option and price comes from the pricing master — the same numbers the
// landing pages, CRM price list, quotations and catalogue feed use.
const ADD_ON = PRICING_MASTER.find((p) => p.addOnOnly) ?? null;
const CHOICES: Choice[] = PRICING_MASTER.filter((p) => !p.addOnOnly).map((p) => ({
  key: p.contentId,
  group: PRICE_GROUP_LABEL[p.group],
  label: p.bhk ? `${p.bhk} ${p.variant}` : p.name,
  category: p.category,
  variant: p.variant,
  packageName: p.bhk ? `${p.bhk} ${p.variant}` : undefined,
  propertyType: p.bhk,
  unitPrice: p.price,
  unit: p.unit,
  minQty: p.minQty,
}));

const card = "rounded-2xl bg-white p-5 shadow-sm";
const input = "h-11 w-full rounded-xl border border-[#0a2540]/15 bg-white px-3 text-sm outline-none focus:border-primary";
const fmtDay = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export function BookingWizard({ quote, defaultChoice, campaignName }: { quote?: QuotePrefill | null; defaultChoice?: string; campaignName?: string }) {
  const [choiceKey, setChoiceKey] = useState(defaultChoice && CHOICES.some((c) => c.key === defaultChoice) ? defaultChoice : "");
  const [qty, setQty] = useState(1);
  const [addOn, setAddOn] = useState(false);
  const [dates, setDates] = useState<{ date: string; available: boolean }[] | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ slot: string; available: boolean }[] | null>(null);
  const [slot, setSlot] = useState("");
  const [name, setName] = useState(quote?.customerName ?? "");
  const [mobile, setMobile] = useState(quote?.mobile ?? "");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [pay, setPay] = useState<"PAY_ADVANCE" | "PAY_AFTER_SERVICE" | "">("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choice = CHOICES.find((c) => c.key === choiceKey) ?? null;
  const minQty = choice?.minQty ?? 1;

  useEffect(() => {
    getDateAvailability(21).then(setDates).catch(() => setDates([]));
  }, []);
  useEffect(() => {
    setQty(minQty);
  }, [choiceKey, minQty]);
  useEffect(() => {
    setSlot("");
    setSlots(null);
    if (!date) return;
    getSlotAvailability(date).then((r) => setSlots(r.ok ? r.slots : [])).catch(() => setSlots([]));
  }, [date]);

  const total = useMemo(() => {
    if (quote) return quote.totalAmount;
    if (!choice || choice.unitPrice == null) return null;
    return choice.unitPrice * (choice.minQty ? qty : 1) + (addOn && ADD_ON ? ADD_ON.price ?? 0 : 0);
  }, [quote, choice, qty, addOn]);

  const serviceLine = quote
    ? quote.services.join(", ")
    : choice
      ? `${choice.label}${choice.minQty ? ` × ${qty}` : ""}${addOn && ADD_ON ? ` + ${ADD_ON.name}` : ""}`
      : "";
  const ready = (quote || choice) && date && slot && pay && (quote || (name.trim().length >= 2 && /^\d{10}$/.test(mobile.replace(/\D/g, "").slice(-10)) && area.trim()));

  function submit() {
    setError("");
    if (!ready) return setError("Please complete all steps.");
    startTransition(async () => {
      const res = await publicBookLead({
        name: name.trim(),
        mobile: mobile.replace(/\D/g, "").slice(-10),
        area: area.trim(),
        address: address.trim(),
        serviceCategory: quote ? "HOME_DEEP_CLEANING" : choice!.category,
        serviceVariant: quote ? "" : choice!.variant,
        packageName: quote ? "" : choice!.packageName ?? "",
        propertyType: quote ? "" : choice!.propertyType ?? "",
        comboServices: addOn && ADD_ON ? [ADD_ON.name] : [],
        estimatedAmount: total ?? undefined,
        serviceDate: date,
        timeSlot: slot,
        paymentPreference: pay || undefined,
        quotationToken: quote?.token ?? "",
        notes: [quote ? `Quotation ${quote.quoteNumber}` : `${campaignName ? `${campaignName} — ` : "Booking page — "}${serviceLine}`, notes.trim()].filter(Boolean).join(" · "),
        source: "WEBSITE",
        attribution: getAttributionPayload(),
      });
      if ("error" in res && res.error) return setError(res.error);
      trackLead({ category: quote ? "QUOTATION" : choice!.category, variant: quote ? quote.quoteNumber : choice!.variant });
      setDone("leadNumber" in res ? (res.leadNumber ?? "") : "");
    });
  }

  if (done !== null) {
    return (
      <div className={`${card} text-center`}>
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <h3 className="mt-2 text-xl font-bold">Booking request received</h3>
        <p className="mt-1 text-sm text-[#0a2540]/75">Reference: <span className="font-semibold">{done}</span></p>
        <p className="mt-2 text-sm text-[#0a2540]/75">
          {serviceLine} · {fmtDay(date)} · {slot}
        </p>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          This is not yet a confirmed booking. Our team will confirm your slot shortly — you&apos;ll receive the confirmation with your booking link on WhatsApp.
        </p>
      </div>
    );
  }

  const groups = [...new Set(CHOICES.map((c) => c.group))];
  const step = (n: number, title: string) => (
    <h3 className="flex items-center gap-2 text-lg font-bold">
      <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-white">{n}</span>
      {title}
    </h3>
  );

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
          <div className="mt-3 space-y-4">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0a2540]/60">{g}</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {CHOICES.filter((c) => c.group === g).map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setChoiceKey(c.key)}
                      className={`rounded-xl border p-3 text-left text-sm transition ${choiceKey === c.key ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-[#0a2540]/10 bg-white hover:border-primary/40"}`}
                    >
                      <span className="block font-semibold">{c.label}</span>
                      <span className="block text-primary">
                        {c.unitPrice == null ? "Price after inspection" : `${inr(c.unitPrice)}${c.unit ? ` ${c.unit}` : ""}`}
                      </span>
                      {c.minQty && c.minQty > 1 && <span className="block text-[11px] font-bold uppercase text-amber-700">Minimum {c.minQty}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {choice?.minQty && (
            <div className="mt-3 flex items-center gap-3 text-sm">
              <span className="font-semibold">Quantity</span>
              <button type="button" onClick={() => setQty((q) => Math.max(minQty, q - 1))} className="size-9 rounded-full border text-lg">−</button>
              <span className="w-8 text-center font-bold">{qty}</span>
              <button type="button" onClick={() => setQty((q) => q + 1)} className="size-9 rounded-full border text-lg">+</button>
            </div>
          )}
          {choice && choice.unitPrice != null && ADD_ON && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={addOn} onChange={(e) => setAddOn(e.target.checked)} className="size-4" />
              Add {ADD_ON.name} ({inr(ADD_ON.price ?? 0)}, add-on)
            </label>
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
                className={`rounded-xl border p-2 text-center text-xs font-semibold ${date === d.date ? "border-primary bg-primary text-white" : d.available ? "border-[#0a2540]/10 bg-white hover:border-primary/40" : "cursor-not-allowed border-transparent bg-[#0a2540]/5 text-[#0a2540]/35 line-through"}`}
              >
                <CalendarDays className="mx-auto mb-0.5 size-3.5" />
                {fmtDay(d.date)}
                {!d.available && <span className="block text-[10px] no-underline">Full</span>}
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
            <input className={input} placeholder="Area / society * (e.g. Magarpatta)" value={area} onChange={(e) => setArea(e.target.value)} />
            <input className={input} placeholder="Full address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
            <textarea className={`${input} h-20 py-2 sm:col-span-2`} placeholder="Anything we should know? (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      )}

      <div className={card}>
        {step(quote ? 4 : 5, "Payment preference")}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {([
            ["PAY_ADVANCE", "Pay Advance", "Secure your slot with an advance — payment details are shared on your booking page."],
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
          <dt className="text-[#0a2540]/60">Service</dt><dd className="font-medium">{serviceLine || "—"}</dd>
          <dt className="text-[#0a2540]/60">Date</dt><dd className="font-medium">{date ? fmtDay(date) : "—"}</dd>
          <dt className="text-[#0a2540]/60">Time</dt><dd className="font-medium">{slot || "—"}</dd>
          <dt className="text-[#0a2540]/60">Payment</dt><dd className="font-medium">{pay === "PAY_ADVANCE" ? "Pay advance" : pay === "PAY_AFTER_SERVICE" ? "Pay after service" : "—"}</dd>
          <dt className="text-[#0a2540]/60">{quote ? "Quoted amount" : "Package price"}</dt>
          <dd className="font-extrabold text-primary">{total != null ? inr(total) : choice ? "After inspection" : "—"}</dd>
        </dl>
        <p className="mt-3 text-xs text-[#0a2540]/65">Your booking is confirmed only after our team verifies the slot. You&apos;ll receive the confirmation on WhatsApp.</p>
        {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
        <button type="button" onClick={submit} disabled={!ready || pending} className="mt-3 w-full rounded-xl bg-primary py-3.5 text-base font-bold text-white disabled:opacity-50">
          {pending ? "Sending…" : "Confirm Booking Request"}
        </button>
      </div>
    </div>
  );
}
