"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, CheckCircle2, Clock, MapPin, MessageCircle, Phone, X } from "lucide-react";
import { OPEN_EVENT, type LeadIntent } from "@/components/public/bhk-price-cards";
import { trackFunnel, trackLead, trackSchedule } from "@/components/public/marketing-tags";
import { getAttributionPayload } from "@/components/public/attribution-capture";
import { getDateAvailability, getSlotAvailability } from "@/server/actions/slot-availability";
import { publicBookLead } from "@/server/actions/public-booking";
import { getQuickAddOns } from "@/server/actions/public-addons";
import { LOCALITIES, ZONES, type ZoneKey } from "@/config/pune-seo-matrix";
import { CHECKOUT_CHIP_IDS, EXTRA_AREAS, MOQ_VALUE, ZONE_B_MOV_MESSAGE, moqFor, normalizePincode, upgradeBundle, type AddOn } from "@/lib/zonal-moq";

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
const WEST_PCMC = LOCALITIES.filter((l) => l.zone === "west-pcmc").map((l) => l.slug);
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
  const [pincode, setPincode] = useState("");
  const [pool, setPool] = useState<AddOn[]>([]);
  const [extras, setExtras] = useState<AddOn[]>([]);
  const first = useRef<HTMLInputElement>(null);
  const doneId = useRef("");
  const doneConfirmed = useRef(false);

  useEffect(() => {
    const on = (e: Event) => {
      setIntent((e as CustomEvent<LeadIntent>).detail);
      setState("idle");
      setError("");
      setDone(null);
      setSlot("");
      setExtras([]);
      const d = (e as CustomEvent<LeadIntent>).detail;
      trackFunnel("start_booking", { service: d?.category ?? d?.service, package: d?.pkg });
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
    getDateAvailability(30)
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
  // Zonal minimum order value (lib/zonal-moq.ts, final sprint 2026-11-02): every priced non-pest basket below ₹3,999 in
  // Zone B (PIN code or area) is blocked until it reaches the minimum — the server enforces the same rule.
  const priced = booking && (intent.price ?? 0) > 0;
  const moqApplies = priced && intent.category !== "PEST_CONTROL";
  const pin = normalizePincode(pincode);
  const moq = moqApplies ? moqFor({ locality, pincode: pin.length === 6 ? pin : "", gps }, WEST_PCMC).moq : 0;
  const extrasTotal = extras.reduce((t, x) => t + x.price * x.minQty, 0);
  const subtotal = (intent.price ?? 0) + extrasTotal;
  const gap = moq > 0 ? Math.max(0, moq - subtotal) : 0;
  const inBasket = [...(intent.items ?? []).map((i) => i.contentId), ...extras.map((x) => x.contentId)];
  // 1-click checkout chips: Fridge ₹499 · Chimney ₹699 · Pest Control Shot ₹899 · Balcony ₹499 (live prices from the pool).
  const chips = CHECKOUT_CHIP_IDS.map((id) => pool.find((a) => a.contentId === id)).filter((a): a is AddOn => !!a && !(intent.category === "PEST_CONTROL" && a.contentId === "SCS-36") && !(intent.items ?? []).some((i) => i.contentId === a.contentId));
  const upgrade = gap > 0 ? (upgradeBundle(gap, chips, inBasket).length ? upgradeBundle(gap, chips, inBasket) : upgradeBundle(gap, pool, inBasket)) : [];
  const toggleExtra = (a: AddOn) => {
    if (!extras.some((x) => x.contentId === a.contentId)) trackFunnel("select_addon", { service: intent.category, item: a.name, value: a.price * a.minQty });
    setExtras((cur) => (cur.some((x) => x.contentId === a.contentId) ? cur.filter((x) => x.contentId !== a.contentId) : [...cur, a]));
  };

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
    if (!locality) return setError("Please choose your area.");
    if (area.length < 3) return setError("Please enter your flat / society / building or a landmark.");
    // PIN code is optional (owner 2026-11-03): the area alone completes a booking; a PIN, when given, must be 6 digits.
    if (pin.length > 0 && pin.length !== 6) return setError("PIN code should be 6 digits — or leave it blank.");
    if (gap > 0) return setError(`${ZONE_B_MOV_MESSAGE} Add ${inr(gap)} more.`);
    const company = String(f.get("company") ?? "").trim();
    const propType = String(f.get("propType") ?? "");
    const sqft = String(f.get("sqft") ?? "").replace(/\D/g, "").slice(0, 7);
    if (intent!.b2b && company.length < 2) return setError("Please enter your company / society name.");
    const mapsUrl = gps ? `https://maps.google.com/?q=${gps.lat},${gps.lng}` : "";
    const locName = LOCALITIES.find((l) => l.slug === locality)?.name ?? EXTRA_AREAS.find((x) => x.slug === locality)?.name ?? "";
    const where = [area, locName, gps && `GPS ${gps.lat},${gps.lng}`].filter(Boolean).join(" · ");
    setState("sending");
    try {
      if (booking) {
        const r = await publicBookLead({
          name, mobile, website: String(f.get("website") ?? ""),
          area: (locName || area).slice(0, 100) || (gps ? "GPS location" : ""),
          address: where.slice(0, 400),
          pinCode: pin.length === 6 ? pin : "",
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
        doneId.current = (ok.status === "CONFIRMED" ? ok.jobNumber : ok.leadNumber) || ok.leadNumber || "";
        doneConfirmed.current = ok.status === "CONFIRMED";
        setDone({ kind: ok.status === "CONFIRMED" ? "confirmed" : "received", id: doneId.current, slotText, price: subtotal || null });
      } else {
        const p = getAttributionPayload();
        const t = p.first ?? p.latest ?? null;
        const res = await fetch("/api/leads/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, mobile, website: String(f.get("website") ?? ""), service: intent!.service, location: [where, pin.length === 6 && `PIN ${pin}`].filter(Boolean).join(" · "),
            source: intent!.b2b ? "Website B2B site audit" : "",
            preferredDate: date, preferredSlot: slot,
            message: [intent!.b2b ? `B2B free site audit — ${label}` : `Website inquiry — ${label}`, intent!.b2b && `Company: ${company}`, intent!.b2b && propType && `Property: ${propType}`, intent!.b2b && sqft && `Approx. area: ${sqft} sq ft`, `Preferred visit ${slotText}`, mapsUrl && `Location ${mapsUrl} (±${gps!.acc} m)`, notes && `Notes: ${notes}`].filter(Boolean).join(" · "),
            utm_source: t?.source ?? "", utm_medium: t?.medium ?? "", utm_campaign: t?.campaign ?? "",
            landing_page_url: t?.landingPageUrl ?? window.location.href.slice(0, 500),
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; leadId?: string };
        if (!res.ok || !j.ok) { setState("idle"); return setError(j.error || "Couldn't send. Please call or WhatsApp us."); }
        doneId.current = j.leadId ?? "";
        doneConfirmed.current = false;
        setDone({ kind: "inquiry", id: doneId.current, slotText, price: null });
      }
      setState("idle");
      // Every booking/inquiry: GTM dataLayer + GA4 generate_lead + Ads conversion + Meta Lead (Pixel & CAPI, one event id).
      trackLead({ category: intent!.category ?? intent!.service, variant: intent!.pkg, mobile, value: booking ? subtotal || undefined : undefined, id: doneId.current, kind: booking ? "booking" : "inquiry", confirmed: doneConfirmed.current });
      if (!booking) trackSchedule({ category: intent!.service, mobile });
      trackFunnel(booking ? "booking_confirmation" : "schedule_inspection", { service: intent!.category ?? intent!.service, value: booking ? subtotal || undefined : undefined });
    } catch {
      setState("idle");
      setError("No connection. Please try again, or call us.");
    }
  }

  const input = "min-h-12 w-full rounded-2xl border-2 border-[#0a2540]/10 bg-white px-3.5 text-base text-[#0a2540] outline-none transition focus:border-primary";
  const title = done ? (done.kind === "confirmed" ? "Your Booking Has Been Confirmed!" : done.kind === "received" ? "Booking Received!" : "Inquiry Received!") : intent.b2b ? "Free Site Audit Request" : intent.inspection || !intent.category ? "Request Inspection / Inquiry" : "Book in 10 seconds";

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
                {done.kind === "confirmed" ? "Our team details and arrival updates will follow on WhatsApp." : done.kind === "received" ? "Your slot request is in our system — our team confirms it shortly on a call / WhatsApp." : "Our supervisor will call you to fix the site visit."}
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

              <fieldset className="min-w-0 space-y-2 rounded-3xl bg-white p-3 shadow-sm">
                <legend className="sr-only">Address</legend>
                <p className="flex items-center gap-1.5 text-sm font-bold"><MapPin className="size-4 text-primary" />Full address</p>
                <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
                <select name="locality" value={locality} onChange={(e) => setLocality(e.target.value)} aria-label="Area" required className={input}>
                  <option value="">Choose your area *</option>
                  {(Object.keys(ZONES) as ZoneKey[]).map((z) => (
                    <optgroup key={z} label={ZONES[z].label}>
                      {LOCALITIES.filter((l) => l.zone === z).map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
                      {EXTRA_AREAS.filter((x) => x.group === ZONES[z].label).map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
                    </optgroup>
                  ))}
                  <option value="other">Other area</option>
                </select>
                <input name="pincode" value={pincode} onChange={(e) => setPincode(normalizePincode(e.target.value))} inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="PIN (optional)" aria-label="PIN code (optional)" className={input} />
                </div>
                <input name="area" autoComplete="street-address" required placeholder="Flat / society / building / landmark *" className={input} />
                <button type="button" onClick={locate} disabled={gpsState === "locating"} className={`inline-flex items-center gap-1 text-xs font-bold ${gps ? "text-emerald-700" : "text-primary"}`}>
                  {gps ? `📍 Location added (±${gps.acc} m)` : gpsState === "locating" ? "Locating…" : "📍 Use current location (optional)"}
                </button>
                {gpsState === "denied" && <p className="text-xs text-amber-700">Location unavailable — the address above is enough.</p>}
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

              <fieldset className="min-w-0">
                <legend className="flex items-center gap-1.5 text-sm font-bold"><CalendarCheck className="size-4 text-primary" />{intent.inspection ? "Visit date" : "Date"}</legend>
                {days === null ? (
                  <div className="mt-1.5 h-64 animate-pulse rounded-3xl bg-white" />
                ) : days.length === 0 ? (
                  <input name="dateFallback" type="date" min={istToday()} value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1.5`} aria-label="Preferred date" />
                ) : (
                  <MonthCalendar days={days} value={date} onChange={(d) => { setDate(d); setSlot(""); }} />
                )}
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

              {priced && (
                <div className={`rounded-3xl p-3 ${gap > 0 ? "bg-amber-50 ring-1 ring-amber-200" : "bg-white shadow-sm"}`} aria-live="polite">
                  {chips.length > 0 && (
                    <>
                      <p className="text-sm font-bold">Add to this visit <span className="font-normal text-[#0a2540]/55">(1 tap)</span></p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {chips.map((a) => {
                          const on = extras.some((x) => x.contentId === a.contentId);
                          return (
                            <button key={a.contentId} type="button" aria-pressed={on} onClick={() => toggleExtra(a)} className={`min-h-10 rounded-full border-2 px-3 text-xs font-extrabold transition ${on ? "border-primary bg-primary text-white" : "border-[#0a2540]/10 bg-white text-[#0a2540] hover:border-primary/50"}`}>
                              {on ? "✓ " : "+ "}{a.name.replace(" (add-on)", "").replace(" Cleaning", "")} {inr(a.price * a.minQty)}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {extras.filter((x) => !chips.some((c) => c.contentId === x.contentId)).length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs">
                      {extras.filter((x) => !chips.some((c) => c.contentId === x.contentId)).map((x) => <li key={x.contentId} className="flex items-center justify-between gap-2"><span>+ {x.name}{x.minQty > 1 ? ` ×${x.minQty}` : ""} · {inr(x.price * x.minQty)}</span><button type="button" onClick={() => toggleExtra(x)} className="font-bold text-red-600">Remove</button></li>)}
                    </ul>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#0a2540]/10 pt-2 text-sm">
                    <span className="font-bold">Order total</span>
                    <span className="text-lg font-extrabold">{inr(subtotal)}</span>
                  </div>
                  {gap > 0 ? (
                    <div role="alert" className="mt-2">
                      <p className="text-xs font-bold text-amber-900">{ZONE_B_MOV_MESSAGE}</p>
                      <p className="mt-0.5 text-xs text-amber-800">Add {inr(gap)} more to book.</p>
                      {upgrade.length > 0 && (
                        <button type="button" onClick={() => setExtras((cur) => [...cur, ...upgrade.filter((u) => !cur.some((x) => x.contentId === u.contentId))])} className="mt-2 min-h-12 w-full rounded-2xl bg-amber-400 px-3 text-sm font-extrabold text-[#0a2540] shadow-sm hover:bg-amber-300">
                          Add Add-on / Upgrade to {inr(MOQ_VALUE)} Combo
                        </button>
                      )}
                    </div>
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

/**
 * 30-day monthly calendar (Phase 2 refinements): month grid with prev / next month, each bookable day coloured from the CRM
 * capacity calendar — Available (green) · Filling Fast (orange) · Fully Booked (red, disabled). Days outside the 30-day window
 * are greyed out. Keyboard: every day is a real button.
 */
function MonthCalendar({ days, value, onChange }: { days: DayInfo[]; value: string; onChange: (ymd: string) => void }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const months = Array.from(new Set(days.map((d) => d.date.slice(0, 7))));
  const [m, setM] = useState(Math.max(0, months.indexOf((value || days[0].date).slice(0, 7))));
  const ym = months[m] ?? months[0];
  const [y, mo] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first grid
  const count = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  const title = first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const tone = { AVAILABLE: "bg-emerald-50 text-emerald-800 ring-emerald-200", FILLING: "bg-orange-50 text-orange-800 ring-orange-200", FULL: "bg-red-50 text-red-400 ring-red-100" } as const;
  return (
    <div className="mt-1.5 rounded-3xl bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setM((v) => Math.max(0, v - 1))} disabled={m === 0} aria-label="Previous month" className="flex size-9 items-center justify-center rounded-full bg-[#eef4fb] text-lg font-bold disabled:opacity-30">‹</button>
        <p className="text-sm font-extrabold">{title}</p>
        <button type="button" onClick={() => setM((v) => Math.min(months.length - 1, v + 1))} disabled={m >= months.length - 1} aria-label="Next month" className="flex size-9 items-center justify-center rounded-full bg-[#eef4fb] text-lg font-bold disabled:opacity-30">›</button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#0a2540]/45">{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d}>{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1" role="radiogroup" aria-label={`Dates in ${title}`}>
        {cells.map((c, i) => {
          if (!c) return <span key={`b${i}`} />;
          const d = byDate.get(c);
          const on = c === value;
          const day = Number(c.slice(8));
          if (!d) return <span key={c} className="flex aspect-square items-center justify-center rounded-xl text-sm text-[#0a2540]/25">{day}</span>;
          return (
            <button key={c} type="button" role="radio" aria-checked={on} aria-label={`${c} — ${BADGE[d.status].text}`} disabled={!d.available} onClick={() => onChange(c)} className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-extrabold ring-1 transition ${on ? "bg-primary text-white ring-primary shadow-md" : tone[d.status]} ${d.available ? "" : "cursor-not-allowed line-through"}`}>
              {day}
              <span className={`mt-0.5 size-1.5 rounded-full ${on ? "bg-white" : BADGE[d.status].dot}`} />
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] font-bold">
        {(["AVAILABLE", "FILLING", "FULL"] as const).map((k) => <span key={k} className="inline-flex items-center gap-1"><span className={`size-2 rounded-full ${BADGE[k].dot}`} />{BADGE[k].text}</span>)}
      </p>
    </div>
  );
}
