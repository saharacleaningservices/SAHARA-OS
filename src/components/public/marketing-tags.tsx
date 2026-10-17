"use client";

import Script from "next/script";
import { useEffect } from "react";
import { isProtectedNumber } from "@/lib/protected-numbers";

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
const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type Gtag = (...args: unknown[]) => void;
const gtag = (): Gtag | null =>
  typeof window !== "undefined" && typeof (window as { gtag?: Gtag }).gtag === "function" ? (window as unknown as { gtag: Gtag }).gtag : null;
const fbq = (): Gtag | null =>
  typeof window !== "undefined" && typeof (window as { fbq?: Gtag }).fbq === "function" ? (window as unknown as { fbq: Gtag }).fbq : null;

function newEventId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  return c?.randomUUID ? c.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Conversions API relay (the server adds IP / user agent / fbp / fbc). Fire-and-forget; skipped outside a browser page. */
function sendServerEvent(eventName: "Lead" | "Schedule", eventId: string, d: { category?: string; variant?: string; mobile?: string }) {
  if (!PIXEL || typeof window === "undefined" || !window.location || typeof fetch !== "function") return;
  try {
    void fetch("/api/meta/capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, eventId, mobile: d.mobile, category: d.category, variant: d.variant }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* tracking must never break the form */
  }
}

/** Fire once after a successful booking/lead form submission. */
export function trackLead(details: { category?: string; variant?: string; mobile?: string }) {
  // Owner-protected / internal numbers never reach any ad or analytics platform.
  if (isProtectedNumber(details.mobile)) return;
  // One shared id: the browser Pixel and the server (Conversions API) both send it, so Meta counts the lead once.
  const eventId = newEventId();
  fbq()?.("track", "Lead", { content_name: details.variant, content_category: details.category }, { eventID: eventId });
  sendServerEvent("Lead", eventId, details);
  const g = gtag();
  if (!g) return;
  g("event", "generate_lead", { service_category: details.category, service_variant: details.variant });
  if (ADS && ADS_LEAD_LABEL) g("event", "conversion", { send_to: `${ADS}/${ADS_LEAD_LABEL}` });
}

/** Site-visit / inspection requests (commercial, painting, pest, housekeeping): Meta "Schedule" + GA4. */
export function trackSchedule(details: { category?: string; mobile?: string }) {
  if (isProtectedNumber(details.mobile)) return;
  fbq()?.("track", "Schedule", { content_category: details.category });
  gtag()?.("event", "schedule_inspection", { service_category: details.category });
}

/**
 * Booking-funnel step (view_service, select_service, select_category, select_package,
 * select_addon, select_date, select_time, start_booking, submit_booking,
 * booking_confirmation). Sent to the same GA4 / Ads gtag; no-op when tags are not loaded.
 */
export function trackFunnel(event: string, params: Record<string, string | number | undefined> = {}) {
  gtag()?.("event", event, { ...params, page_path: typeof window !== "undefined" ? window.location.pathname : undefined });
}

/** withPixel: also load the Meta Pixel (pages other than /book, which loads its own). */
export function MarketingTags({ withPixel = false }: { withPixel?: boolean } = {}) {
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

  const pixel = withPixel && PIXEL;
  if (!GA4 && !ADS && !pixel) return null;
  const ids = [GA4, ADS].filter(Boolean) as string[];
  return (
    <>
      {pixel && (
        <Script id="sahara-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL}');fbq('track','PageView');`}
        </Script>
      )}
      {ids.length > 0 && <Script src={`https://www.googletagmanager.com/gtag/js?id=${ids[0]}`} strategy="afterInteractive" />}
      {ids.length > 0 && (
        <Script id="sahara-gtag" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());${ids
            .map((id) => `gtag('config','${id}');`)
            .join("")}`}
        </Script>
      )}
    </>
  );
}
