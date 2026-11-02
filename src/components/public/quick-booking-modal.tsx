"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, CheckCircle2, Clock, MapPin, MessageCircle, Phone, X } from "lucide-react";
import { OPEN_EVENT, type LeadIntent } from "@/components/public/bhk-price-cards";
import { trackLead } from "@/components/public/marketing-tags";
import { getAttributionPayload } from "@/components/public/attribution-capture";
import { getDateAvailability, getSlotAvailability } from "@/server/actions/slot-availability";
import { publicBookLead } from "@/server/actions/public-booking";
import { getQuickAddOns } from "@/server/actions/public-addons";
import { LOCALITIES, ZONES, type ZoneKey } from "@/config/pune-seo-matrix";
import { MOQ_VALUE, moqFor, suggestAddOns, type AddOn } from "@/lib/zonal-moq";

/**
 * Quick booking modal — 10-second flow with live CRM slots (owner 2026-11-02, final).
 *   Date strip and time windows come straight from the CRM capacity calendar (server/slot-capacity.ts, incl. the manual
 *   Slot Availability overrides): Available (green) · Filling Fast (orange) · Fully Booked (red, not selectable).
 *   Fixed-price bookings go through the same CRM booking pipeline as /booking (publicBookLead): the server re-prices the
 *   package, re-checks the slot and auto-confirms it into a Job when the owner's auto-confirm rule allows → "Booking Confirmed!"
 *   with the Job ID. Anything the rule leaves for the office (e.g. dates before the auto-confirm start) shows "Booking Received"
 *   with the request ID — the customer is never told a slot is confirmed when it isn't.
 *   Inspection / B2B jobs post to /api/leads/submit as an inquiry.
 * Mounted once per page by LandingShell; opened by openLead() from any card, menu or CTA.
 */

type DayInfo = { date: string; available: boolean; status: "AVAILABLE" | "FILLING" | "FULL" };
type SlotInfo = { slot: string; available: boolean };
type Done = { kind: "confirmed" | "received" | "inquiry"; id: string; slotText: string; price: number | null };

// CRM arrival windows (src/lib/constants.ts TIME_SLOTS without "Flexible"), grouped for scanning.
const FALLBACK_SLOTS = ["8:00 – 10:00 AM", "10:00 AM – 12:00 PM", "12:00 – 2:00 PM", "2:00 – 4:00 PM", "4:00 – 6:00 PM"];
const partOfDay = (slot: string) => (/^(8|10)/.test(slot) ? "Morning" : /^(12|2)/.test(slot) ? "Afternoon" : "Evening");
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const istToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const dayLabel = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00+05:30`);
  return { wd: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }), dm: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) };
};
const BADGE = {
  AVAILABLE: { text: "Available", cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  FILLING: { text: "Filling Fast", cls: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  FULL: { text: "Fully Booked", cls: "bg-red-100 text-red-700", dot: "bg-red-500" },
} as const;

export function LeadModal({ waNumber }: { waNumber: string }) {
  const [intent, setIntent] = useState<LeadIntent | null>(null);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState("");
  const [days, setDays] = useState<DayInfo[] | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [slot, setSlot] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "locating" | "denied">("idle");
  const [vh, setVh] = useState<number | null>(null);
  const [locality, setLocality] = useState("");
  const [pool, setPool] = useState<AddOn[]>([]);
  const [extras, setExtras] = useState<AddOn[]>([]);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = (e: Event) => {
      setIntent((e as CustomEvent<LeadIntent>).detail);
      setState("idle");
      setError("");
      setDone(null);
      setSlot("");
      setExtras([]);
    };
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);

  // On open: body lock, focus, Escape, keyboard-safe height, and the 14-day CRM availability strip.
  useEffect(() => {
    if (!intent) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => first.current?.focus(), 60);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setIntent(null);
    window.addEventListener("keydown", esc);
    const vv = window.visualViewport;
    const onVv = () => vv && setVh(Math.round(vv.height));
    onVv();
    vv?.addEventListener("resize", onVv);
    let alive = true;
    getQuickAddOns().then((a) => alive && setPool(a)).catch(() => {});
    getDateAvailability(14)
      .then((d) => {
        if (!alive) return;
        setDays(d);
        setDate((cur) => cur || d.find((x) => x.available)?.date || "");
      })
      .catch(() => alive && setDays([]));
    return () => { alive = false; document.body.style.overflow = prev; clearTimeout(t); window.removeEventListener("keydown", esc); vv?.removeEventListener("resize", onVv); };
  }, [intent]);

  // Live windows for the chosen date.
  useEffect(() => {
    if (!intent || !date) return;
    let alive = true;
    setSlots(null);
    getSlotAvailability(date)
      .then((r) => alive && setSlots(r.ok ? r.slots.filter((x) => x.slot !== "Flexible") : FALLBACK_SLOTS.map((s) => ({ slot: s, available: true }))))
      .catch(() => alive && setSlots(FALLBACK_SLOTS.map((s) => ({ slot: s, available: true }))));
    return () => { alive = false; };
  }, [intent, date]);

  if (!intent) return null;
  const booking = !!intent.category && !intent.inspection;
  const label = intent.pkg ? `${intent.service} · ${intent.pkg}` : intent.service;
  const dayStatus = days?.find((d) => d.date === date)?.status ?? "AVAILABLE";
  const slotBadge = (s: SlotInfo) => (!s.available ? BADGE.FULL : dayStatus === "FILLING" ? BADGE.FILLING : BADGE.AVAILABLE);
  const slotText = date ? `${dayLabel(date).wd}, ${dayLabel(date).dm}${slot ? ` · ${slot}` : ""}` : "";
  // Zonal minimum order (lib/zonal-moq.ts): only the individual-services / combo basket is gated.
  const moqApplies = booking && intent.category === "INDIVIDUAL_CLEANING";
  const moq = moqApplies ? moqFor({ locality, gps }).moq : 0;
  const extrasTotal = extras.reduce((t, x) => t + x.price * x.minQty, 0);
  const subtotal = (intent.price ?? 0) + extrasTotal;
  const gap = moq > 0 && (locality || gps) ? Math.max(0, moq - subtotal) : 0;
  const suggestions = gap > 0 ? suggestAddOns(gap, pool, [...(intent.items ?? []).map((i) => i.contentId), ...extras.map((x) => x.contentId)]) : [];
  const areaName = LOCALITIES.find((l) => l.slug === locality)?.name ?? (locality === "other" ? "your area" : "");

  function locate() {
    if (!("geolocation" in navigator)) return setGpsState("denied");
    setGpsState("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => { setGps({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), acc: Math.round(p.coords.accuracy) }); setGpsState("idle"); },
      () => setGpsState("denied"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const mobile = String(f.get("mobile") ?? "").replace(/\D/g, "").slice(-10);
    const area = String(f.get("area") ?? "").trim();
    const notes = String(f.get("notes") ?? "").trim();
    if (name.length < 2) return setError("Please enter your name.");
    if (!/^[6-9]\d{9}$/.test(mobile)) return setError("Please enter a valid 10-digit mobile number.");
    if (!date) return setError("Please choose your preferred date.");
    if (!slot) return setError("Please choose a time slot.");
    if (!locality && !gps) return setError("Choose your area or tap “Use Current Location”.");
    if (gap > 0) return setError(`Minimum order in ${areaName || "your area"} is ₹${MOQ_VALUE.toLocaleString("en-IN")} — add ₹${gap.toLocaleString("en-IN")} more.`);
    const company = String(f.get("company") ?? "").trim();
    const propType = String(f.get("propType") ?? "");
    const sqft = String(f.get("sqft") ?? "").replace(/\D/g, "").slice(0, 7);
    if (intent!.b2b && company.length < 2) return setError("Please enter your company / society name.");
    const mapsUrl = gps ? `https://maps.google.com/?q=${gps.lat},${gps.lng}` : "";
    const locName = LOCALITIES.find((l) => l.slug === locality)?.name ?? "";
    const where = [area, locName, gps && `GPS ${gps.lat},${gps.lng}`].filter(Boolean).join(" · ");
    setState("sending");
    try {
      if (booking) {
        const r = await publicBookLead({
          name, mobile, website: String(f.get("website") ?? ""),
          area: (locName || area).slice(0, 100) || (gps ? "GPS location" : ""),
          address: where.slice(0, 400),
          mapLink: mapsUrl,
          serviceCategory: intent!.category,
          serviceVariant: intent!.service.slice(0, 120),
          propertyType: intent!.propertyType ?? "",
          packageName: `${intent!.packageName ?? intent!.pkg ?? ""}${extras.length ? ` + ${extras.map((x) => x.name).join(" + ")}` : ""}`.slice(0, 120),
          selectedItems: [...(intent!.items ?? []), ...extras.map((x) => ({ contentId: x.contentId, qty: x.minQty }))],
          estimatedAmount: subtotal || undefined,
          serviceDate: date,
          timeSlot: slot,
          notes: [`Website quick booking — ${label}${extras.length ? ` + ${extras.map((x) => x.name).join(" + ")}` : ""}${subtotal ? ` · shown total ${inr(subtotal)}` : ""}`, notes && `Customer notes: ${notes}`].filter(Boolean).join("\n").slice(0, 2000),
          source: "",
          attribution: getAttributionPayload(),
        });
        if ("error" in r && r.error) { setState("idle"); return setError(r.error); }
        const ok = r as { leadNumber?: string; status?: "CONFIRMED" | "PENDING"; jobNumber?: string };
        setDone({ kind: ok.status === "CONFIRMED" ? "confirmed" : "received", id: (ok.status === "CONFIRMED" ? ok.jobNumber : ok.leadNumber) || ok.leadNumber || "", slotText, price: subtotal || null });
      } else {
        const p = getAttributionPayload();
        const t = p.first ?? p.latest ?? null;
        const res = await fetch("/api/leads/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, mobile, website: String(f.get("website") ?? ""), service: intent!.service, location: where,
            source: intent!.b2b ? "Website B2B site audit" : "",
            preferredDate: date, preferredSlot: slot,
            message: [intent!.b2b ? `B2B free site audit — ${label}` : `Website inquiry — ${label}`, intent!.b2b && `Company: ${company}`, intent!.b2b && propType && `Property: ${propType}`, intent!.b2b && sqft && `Approx. area: ${sqft} sq ft`, `Preferred visit ${slotText}`, mapsUrl && `Location ${mapsUrl} (±${gps!.acc} m)`, notes && `Notes: ${notes}`].filter(Boolean).join(" · "),
            utm_source: t?.source ?? "", utm_medium: t?.medium ?? "", utm_campaign: t?.campaign ?? "",
            landing_page_url: t?.landingPageUrl ?? window.location.href.slice(0, 500),
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; leadId?: string };
        if (!res.ok || !j.ok) { setState("idle"); return setError(j.error || "Couldn't send. Please call or WhatsApp us."); }
        setDone({ kind: "inquiry", id: j.leadId ?? "", slotText, price: null });
      }
      setState("idle");
      trackLead({ category: intent!.category ?? intent!.service, variant: intent!.pkg, mobile, value: booking ? intent!.price ?? undefined : undefined });
    } catch {
      setState("idle");
      setError("No connection. Please try again, or call us.");
    }
  }

  const input = "min-h-12 w-full rounded-2xl border-2 border-[#0a2540]/10 bg-white px-3.5 text-base text-[#0a2540] outline-none transition focus:border-primary";
  const title = done ? (done.kind === "confirmed" ? "Booking Confirmed!" : done.kind === "received" ? "Booking Received!" : "Inquiry Received!") : intent.b2b ? "Free Site Audit Request" : intent.inspection || !intent.category ? "Request Inspection / Inquiry" : "Book in 10 seconds";

  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex h-[100dvh] items-end justify-center bg-[#0a2540]/60 sm:items-center sm:p-4" style={vh ? { height: vh } : undefined} role="dialog" aria-modal="true" aria-labelledby="lead-title" onClick={(e) => e.target === e.currentTarget && setIntent(null)}>
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-[#f5f8fd] text-[#0a2540] shadow-2xl sm:max-h-[92vh] sm:rounded-[28px]">
        <div className={`flex items-start justify-between gap-3 px-5 pb-4 pt-5 text-white ${done?.kind === "confirmed" ? "bg-gradient-to-br from-emerald-500 to-emerald-700" : "bg-gradient-to-br from-[#0b5ed7] to-[#0a2540]"}`}>
          <div className="min-w-0">
            <h2 id="lead-title" className="text-xl font-extrabold">{title}</h2>
            <p className="truncate text-sm text-white/85">{label}{intent.price ? ` · ${inr(intent.price)}` : ""}</p>
          </div>
          <button type="button" onClick={() => setIntent(null)} aria-label="Close" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"><X className="size-5" /></button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {done ? (
            <div className="py-2 text-center" role="status">
              <CheckCircle2 className={`mx-auto size-14 ${done.kind === "confirmed" ? "text-emerald-600" : "text-primary"}`} />
              <dl className="mt-3 space-y-2 rounded-3xl bg-white p-4 text-left text-sm shadow-sm">
                {done.id && <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">{done.kind === "confirmed" ? "Booking ID" : "Request ID"}</dt><dd className="font-extrabold">{done.id}</dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">Service</dt><dd className="text-right font-semibold">{label}</dd></div>
                {done.slotText && <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">{done.kind === "inquiry" ? "Preferred visit" : "Slot"}</dt><dd className="text-right font-semibold">{done.slotText}</dd></div>}
                {done.price != null && <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">Price</dt><dd className="font-extrabold">{inr(done.price)}</dd></div>}
              </dl>
              <p className="mt-3 text-sm font-semibold text-[#0a2540]/80">
                {done.kind === "confirmed" ? "Your slot is reserved. Our crew details will follow on WhatsApp." : done.kind === "received" ? "Your slot request is in our system — our team confirms it shortly on a call / WhatsApp." : "Our supervisor will call you to fix the site visit."}
              </p>
              {done.kind === "confirmed" && <p className="mt-2 text-xs text-[#0a2540]/60">Track it anytime at <a href="/track" className="font-bold text-primary">saharacleaningservices.com/track</a></p>}
              <a href={`https://wa.me/91${waNumber}?text=${encodeURIComponent(`Hi Sahara, my ${done.kind === "confirmed" ? "booking" : "request"} ${done.id} — ${label}${done.slotText ? `, ${done.slotText}` : ""}.`)}`} target="_blank" rel="noreferrer" className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-sm font-extrabold text-white shadow-md"><MessageCircle className="size-5" /> Chat on WhatsApp for Instant Updates</a>
            </div>
          ) : (
            <form onSubmit={submit} onFocus={(e) => { const t = e.target as HTMLElement; if (/INPUT|TEXTAREA/.test(t.tagName)) setTimeout(() => t.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" }), 280); }} className="min-w-0 space-y-4 overflow-x-clip" noValidate>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm font-bold">Name<input ref={first} name="name" autoComplete="name" required className={`${input} mt-1`} /></label>
                <label className="block text-sm font-bold">Mobile<input name="mobile" type="tel" inputMode="numeric" autoComplete="tel" maxLength={14} required placeholder="10-digit" className={`${input} mt-1`} /></label>
              </div>

              <fieldset className="min-w-0">
                <legend className="flex items-center gap-1.5 text-sm font-bold"><CalendarCheck className="size-4 text-primary" />{intent.inspection ? "Visit date" : "Date"}</legend>
                <div className="mt-1.5 flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="radiogroup" aria-label="Date">
                  {days === null && Array.from({ length: 5 }, (_, i) => <span key={i} className="h-[72px] w-[74px] shrink-0 animate-pulse rounded-2xl bg-white" />)}
                  {days?.length === 0 && <input name="dateFallback" type="date" min={istToday()} value={date} onChange={(e) => setDate(e.target.value)} className={input} aria-label="Preferred date" />}
                  {days?.map((d) => {
                    const b = BADGE[d.status];
                    const on = d.date === date;
                    const { wd, dm } = dayLabel(d.date);
                    return (
                      <button key={d.date} type="button" role="radio" aria-checked={on} disabled={!d.available} onClick={() => { setDate(d.date); setSlot(""); }} className={`flex w-[74px] shrink-0 snap-start flex-col items-center rounded-2xl border-2 px-1 py-2 transition ${on ? "border-primary bg-primary text-white shadow-lg" : "border-transparent bg-white"} ${d.available ? "" : "opacity-55"}`}>
                        <span className={`text-[11px] font-bold uppercase ${on ? "text-white/80" : "text-[#0a2540]/55"}`}>{wd}</span>
                        <span className="text-sm font-extrabold">{dm}</span>
                        <span className={`mt-1 flex items-center gap-1 text-[9px] font-extrabold ${on ? "text-white" : ""}`}><span className={`size-1.5 rounded-full ${b.dot}`} />{b.text}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="min-w-0">
                <legend className="flex items-center gap-1.5 text-sm font-bold"><Clock className="size-4 text-primary" />Time slot</legend>
                {!slots ? (
                  <div className="mt-1.5 grid grid-cols-2 gap-2">{Array.from({ length: 4 }, (_, i) => <span key={i} className="h-14 animate-pulse rounded-2xl bg-white" />)}</div>
                ) : (
                  <div className="mt-1.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Time slot">
                    {slots.map((s) => {
                      const b = slotBadge(s);
                      const on = s.slot === slot;
                      return (
                        <button key={s.slot} type="button" role="radio" aria-checked={on} disabled={!s.available} onClick={() => setSlot(s.slot)} className={`flex min-h-14 flex-col items-start justify-center rounded-2xl border-2 px-3 text-left transition ${on ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-transparent bg-white"} ${s.available ? "hover:border-primary/40" : "cursor-not-allowed opacity-60"}`}>
                          <span className="text-[11px] font-bold uppercase text-[#0a2540]/50">{partOfDay(s.slot)}</span>
                          <span className="text-sm font-extrabold">{s.slot}</span>
                          <span className={`mt-0.5 rounded-full px-1.5 text-[10px] font-extrabold ${b.cls}`}>{b.text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>

              {intent.b2b && (
                <div className="space-y-2 rounded-3xl bg-white p-3 shadow-sm">
                  <label className="block text-sm font-bold">Company / society name<input name="company" autoComplete="organization" required className={`${input} mt-1`} /></label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-sm font-bold">Property
                      <select name="propType" defaultValue="Office / IT park" className={`${input} mt-1`}>
                        {["Office / IT park", "Housing society", "Showroom / retail", "Warehouse / industrial", "Hospital / hotel", "Other"].map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-bold">Area (sq ft)<input name="sqft" inputMode="numeric" placeholder="Approx." className={`${input} mt-1`} /></label>
                  </div>
                </div>
              )}

              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold"><MapPin className="size-4 text-primary" />Location</p>
                <div className="mt-1.5 flex gap-2">
                  <select name="locality" value={locality} onChange={(e) => setLocality(e.target.value)} aria-label="Your area" className={`${input} min-w-0 flex-1`}>
                    <option value="">Choose your area</option>
                    {(Object.keys(ZONES) as ZoneKey[]).map((z) => (
                      <optgroup key={z} label={ZONES[z].label}>
                        {LOCALITIES.filter((l) => l.zone === z).map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
                      </optgroup>
                    ))}
                    <option value="other">Other area</option>
                  </select>
                  <button type="button" onClick={locate} disabled={gpsState === "locating"} aria-label="Use current location" className={`flex min-h-12 shrink-0 items-center rounded-2xl px-3 text-xs font-extrabold ${gps ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"}`}>
                    {gps ? "📍 Located" : gpsState === "locating" ? "Locating…" : "📍 Use Current Location"}
                  </button>
                </div>
                <input name="area" autoComplete="street-address" placeholder="Society / building / landmark (optional)" className={`${input} mt-2`} />
                {gps && <p className="mt-1 text-xs text-emerald-700">Location captured (±{gps.acc} m)</p>}
                {gpsState === "denied" && <p className="mt-1 text-xs text-amber-700">Location unavailable — please choose your area.</p>}
              </div>

              {moqApplies && (locality || gps) && (
                <div className={`rounded-3xl p-3 ${gap > 0 ? "bg-amber-50 ring-1 ring-amber-200" : "bg-emerald-50 ring-1 ring-emerald-200"}`} aria-live="polite">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-bold">Order total</span>
                    <span className="text-lg font-extrabold">{inr(subtotal)}</span>
                  </div>
                  {extras.length > 0 && (
                    <ul className="mt-1 space-y-1 text-xs">
                      {extras.map((x) => <li key={x.contentId} className="flex items-center justify-between gap-2"><span>+ {x.name}</span><button type="button" onClick={() => setExtras(extras.filter((e) => e.contentId !== x.contentId))} className="font-bold text-red-600">Remove</button></li>)}
                    </ul>
                  )}
                  {gap > 0 ? (
                    <>
                      <p className="mt-1 text-xs font-semibold text-amber-800">Minimum order in {areaName || "your area"} is {inr(MOQ_VALUE)} — add {inr(gap)} more. One tap:</p>
                      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                        {suggestions.map((a) => (
                          <button key={a.contentId} type="button" onClick={() => setExtras([...extras, a])} className="flex min-w-[150px] shrink-0 flex-col rounded-2xl bg-white p-2.5 text-left shadow-sm ring-1 ring-amber-200 hover:ring-primary">
                            <span className="text-xs font-extrabold leading-snug">{a.name}{a.minQty > 1 ? ` ×${a.minQty}` : ""}</span>
                            <span className="mt-1 text-sm font-extrabold text-primary">+ {inr(a.price * a.minQty)}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    moq > 0 && <p className="mt-1 text-xs font-semibold text-emerald-700">Minimum order reached ✓</p>
                  )}
                </div>
              )}
              <label className="block text-sm font-bold">Special notes <span className="font-normal text-[#0a2540]/50">(optional)</span><input name="notes" maxLength={500} placeholder="Size, special requests, best time to call" className={`${input} mt-1`} /></label>
              <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
              <button type="submit" disabled={state === "sending" || gap > 0} className="min-h-14 w-full rounded-2xl bg-gradient-to-r from-[#0b5ed7] to-[#0a2540] text-base font-extrabold text-white shadow-lg disabled:opacity-60">{state === "sending" ? "Sending…" : booking ? "Confirm Your Booking" : "Request Inspection / Submit Inquiry"}</button>
              <p className="flex items-center justify-center gap-1 text-center text-xs text-[#0a2540]/60"><Phone className="size-3" /> Pay after service available</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
