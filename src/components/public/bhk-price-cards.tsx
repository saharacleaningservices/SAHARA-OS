"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, LocateFixed, MessageCircle, Phone, X } from "lucide-react";
import { trackLead } from "@/components/public/marketing-tags";
import { getAttributionPayload } from "@/components/public/attribution-capture";
import type { HomeRow } from "@/components/public/price-selector";

// Homepage price picker, UrbanCompany style (owner 2026-11-01): tap a home size → the Premium and Platinum price cards
// (price, inclusions, Book Now) show right under the buttons. Book Now opens a light lead form (Name, Phone, Date) on the
// same page — no wizard, no page change. The lead goes to /api/leads/submit (same intake as the contact form: CRM lead +
// WhatsApp alert to the team, who call back to confirm the slot).
// No layout shift: 2 BHK is selected on load, so the cards are always there and only their contents change.
// Layout model: BOXED card inside the max-w-6xl page; cards stack on phones, sit side by side from sm.

const OPEN_EVENT = "sahara:open-lead";
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const SIZES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK+"] as const;

export type LeadIntent = { service: string; pkg?: string; price?: number | null; /** On-inspection service: the modal asks for a site visit instead of a slot. */ inspection?: boolean };

/** Opens the lead form from anywhere on the page (service cards, price cards). */
export function openLead(detail: LeadIntent) {
  window.dispatchEvent(new CustomEvent<LeadIntent>(OPEN_EVENT, { detail }));
}

export function BhkPriceCards({ rows, inclusions, note, heading = "Pick your home size" }: { rows: HomeRow[]; inclusions: { Premium: string[]; Platinum: string[] }; note: string; heading?: string }) {
  const [size, setSize] = useState<(typeof SIZES)[number]>("2 BHK");
  const row = rows.find((r) => r.bhk === size);
  const chip = (on: boolean) => `min-h-11 flex-1 whitespace-nowrap rounded-xl px-2 text-sm font-bold transition sm:px-3 ${on ? "bg-primary text-white shadow" : "bg-white text-[#0a2540] ring-1 ring-[#0a2540]/15"}`;

  return (
    <section id="price-selector" aria-labelledby="price-title" className="scroll-mt-20 rounded-2xl bg-white p-3 shadow-sm sm:p-5">
      <h2 id="price-title" className="text-lg font-bold sm:text-xl">{heading}</h2>
      <p className="text-xs text-[#0a2540]/60">Full home deep cleaning · tap your home size</p>
      <div className="mt-3 flex gap-2" role="group" aria-label="Home size">
        {SIZES.map((b) => (
          <button key={b} type="button" aria-pressed={size === b} onClick={() => setSize(b)} className={chip(size === b)}>{b}</button>
        ))}
      </div>

      <div className="mt-3 grid min-h-[300px] gap-3 sm:grid-cols-2" aria-live="polite">
        {size === "4 BHK+" ? (
          <article className="flex flex-col rounded-2xl border border-[#0a2540]/10 bg-[#eef4fb] p-4 sm:col-span-2">
            <p className="text-sm font-extrabold uppercase tracking-wide text-primary">4 BHK, villa & bungalow</p>
            <p className="mt-1 text-2xl font-extrabold text-[#0a2540]">Free site inspection</p>
            <p className="mt-1 text-sm text-[#0a2540]/70">Larger homes are priced after our supervisor visits — a written quote, no obligation.</p>
            <ul className="mt-3 space-y-1.5 text-sm text-[#0a2540]/85">
              {inclusions.Platinum.map((i) => <li key={i} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{i}</li>)}
            </ul>
            <button type="button" onClick={() => openLead({ service: "Home Deep Cleaning", pkg: "4 BHK+ — site inspection", inspection: true })} className="mt-4 min-h-12 rounded-xl bg-primary text-sm font-bold text-white sm:mt-auto">Book Free Inspection</button>
          </article>
        ) : (
          (["Premium", "Platinum"] as const).map((tier) => {
            const price = tier === "Premium" ? row?.premium : row?.platinum;
            return (
              <article key={tier} className={`flex flex-col rounded-2xl border p-4 ${tier === "Platinum" ? "border-amber-300 bg-amber-50/60" : "border-[#0a2540]/10 bg-[#eef4fb]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold uppercase tracking-wide text-primary">{tier}</p>
                  {tier === "Platinum" && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-[#0a2540]">MOST COMPLETE</span>}
                </div>
                <p className="mt-1 text-xs font-semibold text-[#0a2540]/60">{size} · home deep cleaning</p>
                <p className="text-3xl font-extrabold text-[#0a2540]">{price != null ? inr(price) : "On request"}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-[#0a2540]/85">
                  {inclusions[tier].map((i) => <li key={i} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{i}</li>)}
                </ul>
                <button type="button" onClick={() => openLead({ service: "Home Deep Cleaning", pkg: `${size} ${tier}`, price })} className="mt-4 min-h-12 rounded-xl bg-primary text-sm font-bold text-white sm:mt-auto">Book Now</button>
              </article>
            );
          })
        )}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[#0a2540]/60">{note}</p>
    </section>
  );
}

/**
 * Smart lead modal (owner rebuild 2026-11-02) — one per page, mounted by LandingShell and opened by openLead() from any
 * card, menu or CTA. Fields: Name, Mobile, Preferred date, "Use current location" (GPS, with a typed-area fallback) and
 * Notes. Posts to /api/leads/submit → CRM lead with a Lead ID straight away; the WhatsApp + e-mail team alerts are sent by
 * the server in the background so the visitor never waits on them.
 */
export function LeadModal({ waNumber }: { waNumber: string }) {
  const [intent, setIntent] = useState<LeadIntent | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [leadId, setLeadId] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "locating" | "denied">("idle");
  const first = useRef<HTMLInputElement>(null);
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

  useEffect(() => {
    const on = (e: Event) => {
      setIntent((e as CustomEvent<LeadIntent>).detail);
      setState("idle");
      setError("");
      setLeadId("");
    };
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);
  useEffect(() => {
    if (!intent) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => first.current?.focus(), 50);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setIntent(null);
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; clearTimeout(t); window.removeEventListener("keydown", esc); };
  }, [intent]);

  if (!intent) return null;
  const label = intent.pkg ? `${intent.service} · ${intent.pkg}` : intent.service;

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
    const date = String(f.get("date") ?? "");
    const area = String(f.get("area") ?? "").trim();
    const notes = String(f.get("notes") ?? "").trim();
    if (name.length < 2) return setError("Please enter your name.");
    if (!/^[6-9]\d{9}$/.test(mobile)) return setError("Please enter a valid 10-digit mobile number.");
    if (!gps && area.length < 2) return setError("Tap “Use current location” or type your area / society.");
    const p = getAttributionPayload();
    const t = p.first ?? p.latest ?? null;
    const mapsUrl = gps ? `https://maps.google.com/?q=${gps.lat},${gps.lng}` : "";
    setState("sending");
    try {
      const res = await fetch("/api/leads/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, mobile, website: String(f.get("website") ?? ""),
          service: intent!.service,
          location: [area, gps && `GPS ${gps.lat},${gps.lng}`].filter(Boolean).join(" · "),
          preferredDate: date,
          message: [
            `Website lead — ${label}${intent!.price ? ` (${inr(intent!.price)})` : ""}`,
            date && `Preferred date ${date}`,
            mapsUrl && `Location ${mapsUrl} (±${gps!.acc} m)`,
            notes && `Notes: ${notes}`,
          ].filter(Boolean).join(" · "),
          utm_source: t?.source ?? "", utm_medium: t?.medium ?? "", utm_campaign: t?.campaign ?? "",
          landing_page_url: t?.landingPageUrl ?? window.location.href.slice(0, 500),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; leadId?: string };
      if (!res.ok || !j.ok) { setState("idle"); return setError(j.error || "Couldn't send. Please call or WhatsApp us."); }
      setLeadId(j.leadId ?? "");
      setState("done");
      trackLead({ category: intent!.service, variant: intent!.pkg, mobile, value: intent!.price ?? undefined });
    } catch {
      setState("idle");
      setError("No connection. Please try again, or call us.");
    }
  }

  const input = "mt-1 min-h-12 w-full rounded-xl border border-[#0a2540]/15 bg-white px-3 text-base text-[#0a2540] outline-none focus:border-primary";
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0a2540]/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="lead-title" onClick={(e) => e.target === e.currentTarget && setIntent(null)}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 text-[#0a2540] shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="lead-title" className="text-lg font-extrabold">{state === "done" ? "Request received" : intent.inspection ? "Request site inspection / quote" : "Book your slot"}</h2>
            <p className="text-sm text-[#0a2540]/70">{label}{intent.price ? ` · ${inr(intent.price)}` : ""}</p>
          </div>
          <button type="button" onClick={() => setIntent(null)} aria-label="Close" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eef4fb]"><X className="size-5" /></button>
        </div>
        {state === "done" ? (
          <div className="py-4 text-center" role="status">
            <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
            {leadId && <p className="mt-2 text-sm font-semibold text-[#0a2540]/70">Your request ID <span className="rounded-md bg-[#eef4fb] px-2 py-0.5 font-extrabold text-[#0a2540]">{leadId}</span></p>}
            <p className="mt-2 font-semibold">Thank you! Our team will call you shortly to confirm {intent.inspection ? "the site visit" : "the date and time"}.</p>
            <a href={`https://wa.me/91${waNumber}?text=${encodeURIComponent(`Hi Sahara, I just requested ${label} on the website${leadId ? ` (ID ${leadId})` : ""}.`)}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#25D366] px-4 text-sm font-bold text-white"><MessageCircle className="size-4" /> Chat on WhatsApp</a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3" noValidate>
            <label className="block text-sm font-semibold">Name<input ref={first} name="name" autoComplete="name" required className={input} /></label>
            <label className="block text-sm font-semibold">Mobile number<input name="mobile" type="tel" inputMode="numeric" autoComplete="tel" maxLength={14} required placeholder="10-digit mobile" className={input} /></label>
            <label className="block text-sm font-semibold">{intent.inspection ? "Preferred visit date" : "Preferred date"}<input name="date" type="date" min={today} className={input} /></label>
            <div>
              <p className="text-sm font-semibold">Location</p>
              <button type="button" onClick={locate} disabled={gpsState === "locating"} className={`mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold ${gps ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300" : "bg-[#eef4fb] text-primary ring-1 ring-primary/30"}`}>
                <LocateFixed className="size-4" />{gps ? `Location captured (±${gps.acc} m)` : gpsState === "locating" ? "Locating…" : "Use current location"}
              </button>
              {gpsState === "denied" && <p className="mt-1 text-xs text-amber-700">Location unavailable — please type your area below.</p>}
              <input name="area" autoComplete="address-level2" placeholder={gps ? "Society / landmark (optional)" : "Area, society or landmark"} className={input} />
            </div>
            <label className="block text-sm font-semibold">Notes <span className="font-normal text-[#0a2540]/50">(optional)</span><textarea name="notes" rows={2} maxLength={500} placeholder="Size, special requests, best time to call" className={`${input} py-2`} /></label>
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
            {error && <p className="text-sm font-semibold text-red-600" role="alert">{error}</p>}
            <button type="submit" disabled={state === "sending"} className="min-h-12 w-full rounded-xl bg-primary text-base font-bold text-white disabled:opacity-60">{state === "sending" ? "Sending…" : intent.inspection ? "Request Site Inspection" : "Request Booking"}</button>
            <p className="flex items-center justify-center gap-1 text-center text-xs text-[#0a2540]/60"><Phone className="size-3" /> We call back to confirm · Pay after service available</p>
          </form>
        )}
      </div>
    </div>
  );
}
