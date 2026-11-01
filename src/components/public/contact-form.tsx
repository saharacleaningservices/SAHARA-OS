"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { getAttributionPayload } from "@/components/public/attribution-capture";

const SERVICES = ["Home Deep Cleaning", "Office / Commercial Cleaning", "Housekeeping / Facility Management", "Pest Control", "Interior / Exterior Painting", "Post-Interior Cleaning", "Other"];

/**
 * Native contact form (replaces the Cognito Forms iframe, owner 2026-11-01). Posts JSON to /api/leads/submit, which creates the CRM
 * lead and alerts the team on WhatsApp. UTM tags + landing page come from the attribution the site already captured.
 * Layout model: BOXED card, single column on mobile (large tap targets), 2 columns from sm.
 */
export function ContactForm({ defaultBranch = "" }: { defaultBranch?: "magarpatta" | "mohammadwadi" | "" }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [attr, setAttr] = useState<Record<string, string>>({});

  useEffect(() => {
    const p = getAttributionPayload();
    const t = p.first ?? p.latest ?? null;
    setAttr({
      utm_source: t?.source ?? "",
      utm_medium: t?.medium ?? "",
      utm_campaign: t?.campaign ?? "",
      landing_page_url: t?.landingPageUrl ?? window.location.href.slice(0, 500),
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const body: Record<string, string> = { ...attr };
    f.forEach((v, k) => { if (typeof v === "string") body[k] = v.trim(); });
    if (body.name.length < 2) return setError("Please enter your name.");
    if (!/^[6-9]\d{9}$/.test(body.mobile.replace(/\D/g, "").slice(-10))) return setError("Please enter a valid 10-digit mobile number.");
    setState("sending");
    try {
      const res = await fetch("/api/leads/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setState("idle");
        return setError(j.error || "We couldn't send your message. Please call or WhatsApp us.");
      }
      setState("done");
    } catch {
      setState("idle");
      setError("No connection. Your details are still here — please try again, or call us.");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-3xl border border-white/40 bg-white/70 p-8 text-center shadow-xl backdrop-blur-md" role="status">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <h3 className="mt-3 text-2xl font-extrabold text-[#0a2540]">Thank you — we have your message</h3>
        <p className="mt-2 text-[#0a2540]/80">Our team will call you shortly to confirm the details.</p>
      </div>
    );
  }

  const field = "mt-1.5 min-h-12 w-full rounded-xl border border-[#0a2540]/15 bg-white/90 px-3.5 text-base text-[#0a2540] placeholder:text-[#0a2540]/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
  const label = "block text-xs font-bold uppercase tracking-wide text-[#0a2540]/70";
  return (
    <form onSubmit={onSubmit} noValidate className="rounded-3xl border border-white/40 bg-white/60 p-5 shadow-xl backdrop-blur-md sm:p-8" aria-label="Contact Sahara Cleaning Services">
      <h2 className="text-2xl font-extrabold text-[#0a2540]">Send us a message</h2>
      <p className="mt-1 text-sm text-[#0a2540]/70">We reply the same day — usually within the hour.</p>
      {/* Honeypot — hidden from people and screen readers; bots fill it. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className={label}>Your name<input name="name" autoComplete="name" required className={field} placeholder="Full name" /></label>
        <label className={label}>Mobile number<input name="mobile" inputMode="numeric" autoComplete="tel-national" required maxLength={14} className={field} placeholder="10-digit mobile" /></label>
        <label className={label}>Email (optional)<input name="email" type="email" autoComplete="email" className={field} placeholder="you@example.com" /></label>
        <label className={label}>Area in Pune<input name="location" autoComplete="address-level2" className={field} placeholder="e.g. Kharadi, Baner, Hadapsar" /></label>
        <label className={label}>Service
          <select name="service" className={field} defaultValue=""><option value="">Select a service</option>{SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </label>
        <label className={label}>Nearest branch
          <select name="branch" className={field} defaultValue={defaultBranch}><option value="">Not sure</option><option value="magarpatta">Magarpatta City (East &amp; North Pune)</option><option value="mohammadwadi">Mohammadwadi (West, PCMC, South &amp; Central)</option></select>
        </label>
        <label className={`${label} sm:col-span-2`}>Message<textarea name="message" rows={4} maxLength={1000} className={`${field} py-3`} placeholder="Tell us what you need and when" /></label>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
      <button type="submit" disabled={state === "sending"} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-bold text-white disabled:opacity-60 sm:w-auto"><Send className="size-4" /> {state === "sending" ? "Sending…" : "Send message"}</button>
    </form>
  );
}
