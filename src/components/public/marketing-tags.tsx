"use client";

import Script from "next/script";
import { useEffect } from "react";

// Sahara-owned marketing tags for the public pages. Everything is gated on
// env vars, so nothing loads until the owner sets IDs from Sahara's OWN
// accounts (no agency containers):
//   NEXT_PUBLIC_GA4_ID                 e.g. G-74EZWDS33Z (Sahara GA4)
//   NEXT_PUBLIC_GOOGLE_ADS_ID          e.g. AW-765890204 (Sahara Google Ads)
//   NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL  conversion label for "Lead Form Submit"
// Meta Pixel stays in app/book/page.tsx (NEXT_PUBLIC_META_PIXEL_ID).
//
// Only a submitted form counts as a lead. Call / WhatsApp taps are sent as
// separate events so they are never double-counted as form leads.

const GA4 = process.env.NEXT_PUBLIC_GA4_ID;
const ADS = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const ADS_LEAD_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL;

type Gtag = (...args: unknown[]) => void;
const gtag = (): Gtag | null =>
  typeof window !== "undefined" && typeof (window as { gtag?: Gtag }).gtag === "function" ? (window as unknown as { gtag: Gtag }).gtag : null;
const fbq = (): Gtag | null =>
  typeof window !== "undefined" && typeof (window as { fbq?: Gtag }).fbq === "function" ? (window as unknown as { fbq: Gtag }).fbq : null;

/** Fire once after a successful booking/lead form submission. */
export function trackLead(details: { category?: string; variant?: string }) {
  const g = gtag();
  if (!g) return;
  g("event", "generate_lead", { service_category: details.category, service_variant: details.variant });
  if (ADS && ADS_LEAD_LABEL) g("event", "conversion", { send_to: `${ADS}/${ADS_LEAD_LABEL}` });
}

export function MarketingTags() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest?.("a") as HTMLAnchorElement | null;
      if (!a?.href) return;
      const kind = a.href.startsWith("tel:") ? "call_click" : /wa\.me|whatsapp/.test(a.href) ? "whatsapp_click" : null;
      if (!kind) return;
      gtag()?.("event", kind, { link_url: a.href, page_path: window.location.pathname });
      fbq()?.("track", "Contact", { method: kind === "call_click" ? "call" : "whatsapp" });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!GA4 && !ADS) return null;
  const ids = [GA4, ADS].filter(Boolean) as string[];
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${ids[0]}`} strategy="afterInteractive" />
      <Script id="sahara-gtag" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());${ids
          .map((id) => `gtag('config','${id}');`)
          .join("")}`}
      </Script>
    </>
  );
}
