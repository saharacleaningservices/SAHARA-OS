"use client";

import { useState, useTransition } from "react";
import { publicBookLead } from "@/server/actions/public-booking";
import { safely } from "@/lib/safe-action";
import { getAttributionPayload } from "@/components/public/attribution-capture";
import { trackLead } from "@/components/public/marketing-tags";
import { LOCALITIES } from "@/lib/marketing-content";

// Campaign-page hero form: Name · Phone · Locality. Saves the enquiry as a CRM
// lead (same server action as the booking wizard — duplicate-safe by mobile),
// then hands the customer over to WhatsApp with their details pre-filled.

export function QuickLeadForm({ service, serviceLabel, campaignName, packageLabel, waNumber }: {
  service: string;
  serviceLabel: string;
  campaignName: string;
  packageLabel?: string;
  waNumber: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [locality, setLocality] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const waHref = (leadNumber?: string) =>
    `https://wa.me/91${waNumber}?text=${encodeURIComponent(
      [
        `Hi Sahara, I'd like a quote for ${serviceLabel}${packageLabel ? ` (${packageLabel})` : ""}.`,
        `Name: ${name.trim()}`,
        `Phone: ${phone}`,
        `Locality: ${locality}`,
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
    if (!locality) return setError("Please pick your locality.");
    start(async () => {
      const res = await safely(publicBookLead({
        name: name.trim(),
        mobile: phone,
        area: locality,
        address: locality === "Other" ? "" : `${locality}, Pune`,
        serviceCategory: service,
        packageName: packageLabel ?? "",
        notes: `${campaignName} — quick enquiry (hero form)${packageLabel ? ` · ${packageLabel}` : ""}`,
        // Empty: the server derives the lead source from the detected channel (Google Ads,
        // Meta, GBP…) and falls back to WEBSITE — a hard-coded WEBSITE hid ad leads.
        source: "",
        marketingOptIn: false,
        attribution: getAttributionPayload(),
      }));
      if ("error" in res && res.error) return setError(res.error);
      trackLead({ category: service, variant: packageLabel, mobile: phone });
      const lead = "leadNumber" in res ? (res.leadNumber ?? "") : "";
      setDone(lead);
      window.location.href = waHref(lead);
    });
  }

  if (done !== null) {
    return (
      <div className="rounded-2xl bg-white p-4 text-[#0a2540] shadow-lg">
        <p className="font-bold">Thank you, {name.trim().split(" ")[0]}! ✅</p>
        <p className="mt-1 text-sm text-[#0a2540]/70">Request {done} received — our team will call you shortly.</p>
        <a href={waHref(done)} className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-success text-sm font-bold text-white">Continue on WhatsApp</a>
      </div>
    );
  }

  const field = "h-11 w-full rounded-xl border border-[#0a2540]/15 bg-white px-3 text-sm text-[#0a2540] outline-none focus:border-primary";
  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-3 shadow-lg sm:p-4" aria-label="Quick quote">
      <p className="mb-2 text-sm font-bold text-[#0a2540]">Get a Quick Quote</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={field} placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={field} placeholder="10-digit mobile" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
        <select className={field} value={locality} onChange={(e) => setLocality(e.target.value)} aria-label="Locality">
          <option value="">Locality…</option>
          {LOCALITIES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="sahara-shimmer mt-2 min-h-11 w-full rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-60">
        {pending ? "Sending…" : "Get Free Quote"}
      </button>
    </form>
  );
}
