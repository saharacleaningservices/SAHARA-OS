"use client";

import { useEffect } from "react";
import { getAttributionPayload } from "@/components/public/attribution-capture";
import { useWhatsAppRefTagger } from "@/components/public/whatsapp-ref-tagger";
import { contactKindOfHref, fireAdsConversion, fireMetaContact } from "@/lib/ads-conversions";

type Gtag = (...args: unknown[]) => void;

/**
 * Conversion hooks for the SEO / Google Ads landing pages (2026-11-01). One delegated click listener — no per-link
 * wiring, no polling, no layout cost. Pushes `whatsapp_click` / `call_click` to dataLayer (GTM) and fires the Google
 * Ads / GA4 and Meta events only when those tags are present, so nothing breaks while tracking IDs are not set up yet.
 * Attributes read from the page: <body data-seo-*> is avoided; the page passes its context as props instead.
 */
export function SeoCtaTracker({ service, area, branch, vertical }: { service: string; area: string; branch: string; vertical: string }) {
  useWhatsAppRefTagger(getAttributionPayload); // WhatsApp buttons carry "[Ref: …]" for the lead source (lib/source-label.ts)
  useEffect(() => {
    const w0 = window as unknown as { __saharaSeoCtaTracker?: number };
    w0.__saharaSeoCtaTracker = (w0.__saharaSeoCtaTracker ?? 0) + 1; // tells MarketingTags this page sends the richer Contact
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const contact = contactKindOfHref(href);
      if (!contact) return;
      const kind = contact === "call" ? "call_click" : "whatsapp_click";
      const w = window as unknown as { dataLayer?: unknown[]; gtag?: Gtag; fbq?: Gtag };
      const detail = { event: kind, service_category: vertical, service_page: service, area, branch, page_path: window.location.pathname };
      (w.dataLayer = w.dataLayer || []).push(detail);
      if (typeof w.gtag === "function") w.gtag("event", kind, { service_category: vertical, service_page: service, area, branch });
      fireMetaContact(contact, { content_name: service, content_category: vertical, method: contact === "call" ? "call" : "whatsapp" }); // one Contact per tap — shared guard with MarketingTags
      fireAdsConversion(contact); // Secondary Ads conversion; the shared guard stops MarketingTags counting the same tap again
    };
    document.addEventListener("click", onClick, { passive: true });
    return () => {
      document.removeEventListener("click", onClick);
      w0.__saharaSeoCtaTracker = Math.max(0, (w0.__saharaSeoCtaTracker ?? 1) - 1);
    };
  }, [service, area, branch, vertical]);
  return null;
}
