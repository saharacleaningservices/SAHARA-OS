"use client";

import { useState, useTransition } from "react";
import { publicBookLead } from "@/server/actions/public-booking";
import { safely } from "@/lib/safe-action";
import { getAttributionPayload } from "@/components/public/attribution-capture";
import { trackLead, trackSchedule } from "@/components/public/marketing-tags";
import { LOCALITIES } from "@/lib/marketing-content";

// Category landing pages (/commercial-cleaning, /painting-services, /pest-control,
// /housekeeping-services): enquiry / site-visit form. Saves a CRM lead through the same
// duplicate-safe server action as the booking wizard (attribution attached), fires the
// Meta Pixel Lead event (+ Schedule for site-visit / inspection requests) and offers a
// WhatsApp hand-over. No price is ever calculated or shown here — these services are quoted
// after a site visit.

export function CategoryLeadForm({ service, serviceLabel, campaignName, waNumber, title, cta, typeLabel, typeOptions, areaLabel, showCompany, showDate, schedule, stacked, note }: {
  service: string;
  serviceLabel: string;
  campaignName: string;
  waNumber: string;
  title: string;
  cta: string;
  typeLabel?: string;
  typeOptions?: string[];
  areaLabel?: string;
  showCompany?: boolean;
  showDate?: boolean;
  /** Site-visit / inspection request → also fire the Meta "Schedule" event. */
  schedule?: boolean;
  /** One column (narrow hero card). */
  stacked?: boolean;
  /** Footnote under the button; null hides it (default: "no price shown online" text). */
  note?: string | null;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [type, setType] = useState("");
  const [area, setArea] = useState("");
  const [locality, setLocality] = useState("");
  const [date, setDate] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

  const waHref = (leadNumber?: string) =>
    `https://wa.me/91${waNumber}?text=${encodeURIComponent(
      [
        `Hi Sahara, I'd like ${schedule ? "a site visit / quote" : "a quote"} for ${serviceLabel}.`,
        company.trim() ? `Company: ${company.trim()}` : null,
        type ? `${typeLabel ?? "Type"}: ${type}` : null,
        area ? `${areaLabel ?? "Area"}: ${area}` : null,
        `Name: ${name.trim()}`,
        `Phone: ${phone}`,
        locality ? `Locality: ${locality}` : null,
        leadNumber ? `Request ID: ${leadNumber}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (!/^[6-9]\d{9}$/.test(phone)) return setError("Enter a valid 10-digit mobile number.");
    if (typeOptions && !type) return setError(`Please choose ${typeLabel?.toLowerCase() ?? "an option"}.`);
    if (!locality) return setError("Please pick your locality.");
    start(async () => {
      const details = [
        type ? `${typeLabel ?? "Type"}: ${type}` : null,
        area ? `${areaLabel ?? "Area"}: ${area}` : null,
        company.trim() ? `Company: ${company.trim()}` : null,
        date ? `Preferred date: ${date}` : null,
      ].filter(Boolean);
      const res = await safely(publicBookLead({
        name: name.trim(),
        mobile: phone,
        area: locality,
        address: locality === "Other" ? "" : `${locality}, Pune`,
        serviceCategory: service,
        serviceVariant: type,
        notes: `${campaignName} — ${schedule ? "site visit request" : "enquiry"} (landing form)${details.length ? ` · ${details.join(" · ")}` : ""}`,
        source: "", // derived server-side from the detected channel (Google Ads, Meta Ads…)
        marketingOptIn: false,
        website,
        attribution: getAttributionPayload(),
      }));
      if ("error" in res && res.error) return setError(res.error);
      trackLead({ category: service, variant: type || undefined });
      if (schedule) trackSchedule({ category: service });
      setDone("leadNumber" in res ? (res.leadNumber ?? "") : "");
    });
  }

  if (done !== null) {
    return (
      <div id="enquiry" className="scroll-mt-20 rounded-2xl bg-white p-4 text-[#0a2540] shadow-sm">
        <p className="font-bold">Thank you, {name.trim().split(" ")[0]}! ✅</p>
        <p className="mt-1 text-sm text-[#0a2540]/70">{done ? `Request ${done} received — ` : "Request received — "}our team will call you shortly.</p>
        <a href={waHref(done)} className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-success text-sm font-bold text-white">Continue on WhatsApp</a>
      </div>
    );
  }

  const field = "h-11 w-full rounded-xl border border-[#0a2540]/15 bg-white px-3 text-sm text-[#0a2540] outline-none focus:border-primary";
  return (
    <form id="enquiry" onSubmit={submit} className="scroll-mt-20 rounded-2xl bg-white p-4 shadow-sm" aria-label={title}>
      <h2 className="text-lg font-bold text-[#0a2540]">{title}</h2>
      <div className={`mt-3 grid gap-2 ${stacked ? "" : "sm:grid-cols-2"}`}>
        <input className={field} placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={field} placeholder="10-digit mobile" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
        {showCompany && <input className={field} placeholder="Company / society name" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} />}
        {typeOptions && (
          <select className={field} value={type} onChange={(e) => setType(e.target.value)} aria-label={typeLabel}>
            <option value="">{typeLabel ?? "Select"}…</option>
            {typeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        {areaLabel && <input className={field} placeholder={areaLabel} inputMode="numeric" value={area} onChange={(e) => setArea(e.target.value.replace(/[^\d.,\- a-zA-Z]/g, "").slice(0, 40))} />}
        <select className={field} value={locality} onChange={(e) => setLocality(e.target.value)} aria-label="Locality">
          <option value="">Locality…</option>
          {LOCALITIES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        {showDate && <input className={field} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Preferred visit date (optional)" />}
        <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="sahara-shimmer mt-3 min-h-11 w-full rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-60">
        {pending ? "Sending…" : cta}
      </button>
      {note !== null && <p className="mt-2 text-center text-[11px] text-[#0a2540]/60">{note ?? "No price is shown online for this service — we visit, understand your requirement and share a clear quote."}</p>}
    </form>
  );
}
