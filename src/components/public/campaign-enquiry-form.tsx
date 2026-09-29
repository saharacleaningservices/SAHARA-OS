"use client";

import { useState } from "react";
import { publicBookLead } from "@/server/actions/public-booking";
import { getAttributionPayload } from "@/components/public/attribution-capture";
import { trackLead } from "@/components/public/marketing-tags";

// Short enquiry form for campaign landing pages. Goes through the same
// publicBookLead action as /book, so attribution + duplicate protection apply.

const SERVICES: { value: string; label: string }[] = [
  { value: "HOME_DEEP_CLEANING", label: "Home Deep Cleaning (Premium / Platinum)" },
  { value: "INDIVIDUAL_CLEANING", label: "Sofa / Mattress / Kitchen / Bathroom / Carpet" },
  { value: "COMBO_PACKAGE", label: "Combo Package" },
  { value: "COMMERCIAL_CLEANING", label: "Office / Commercial / Villa Cleaning" },
  { value: "PEST_CONTROL", label: "Pest Control" },
  { value: "PAINTING", label: "Interior Painting" },
];
const PROPERTIES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Villa / Bungalow", "Office / Commercial", "Other"];
const SLOTS = ["Morning (9 AM – 12 PM)", "Afternoon (12 – 3 PM)", "Evening (3 – 6 PM)"];

export function CampaignEnquiryForm({ campaignName, defaultService = "" }: { campaignName: string; defaultService?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [ref, setRef] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "").trim();
    const mobile = g("mobile").replace(/\D/g, "").slice(-10);
    if (mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setError("");
    setState("sending");
    const res = await publicBookLead({
      name: g("name"),
      mobile,
      area: g("location"),
      address: g("location"),
      serviceCategory: g("service"),
      propertyType: g("property"),
      serviceDate: g("date"),
      timeSlot: g("slot"),
      notes: [g("message"), `Campaign form: ${campaignName}`].filter(Boolean).join("\n"),
      website: g("website"),
      attribution: getAttributionPayload(),
    });
    if ("error" in res) {
      setState("idle");
      setError(res.error ?? "Something went wrong. Please call us.");
      return;
    }
    trackLead({ category: g("service"), variant: g("property") });
    setRef(res.leadNumber);
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-bold text-primary">Thank you! Your enquiry is received.</p>
        <p className="mt-1 text-sm text-[#0a2540]/70">Reference: {ref}. Our team will call you shortly with the exact quote.</p>
      </div>
    );
  }

  const input = "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm";
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-2">
      <input name="name" required minLength={2} placeholder="Your name *" className={input} autoComplete="name" />
      <input name="mobile" required inputMode="numeric" placeholder="Mobile / WhatsApp number *" className={input} autoComplete="tel" />
      <select name="service" required defaultValue={defaultService} className={input}>
        <option value="" disabled>Service required *</option>
        {SERVICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <select name="property" defaultValue="" className={input}>
        <option value="" disabled>BHK / property type</option>
        {PROPERTIES.map((p) => <option key={p}>{p}</option>)}
      </select>
      <input name="location" placeholder="Location / society (e.g. Magarpatta)" className={input} />
      <div className="grid grid-cols-2 gap-2">
        <input name="date" type="date" className={input} aria-label="Preferred date" />
        <select name="slot" defaultValue="" className={input} aria-label="Preferred time">
          <option value="">Preferred time</option>
          {SLOTS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <textarea name="message" rows={2} placeholder="Message (optional)" className={`${input} sm:col-span-2`} />
      {/* Honeypot */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p className="text-sm font-medium text-red-600 sm:col-span-2">{error}</p>}
      <button disabled={state === "sending"} className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white sm:col-span-2 disabled:opacity-60">
        {state === "sending" ? "Sending…" : "Get My Quote"}
      </button>
      <p className="text-xs text-[#0a2540]/60 sm:col-span-2">We&apos;ll use your number only to contact you about this enquiry.</p>
    </form>
  );
}
