"use client";

import Script from "next/script";
import { useEffect } from "react";
import { isProtectedNumber } from "@/lib/protected-numbers";
import { GOOGLE_ADS_ID, contactKindOfHref, fireAdsConversion } from "@/lib/ads-conversions";
import { getMetaIds } from "@/components/public/attribution-capture";

// Sahara-owned marketing tags for the public pages. Everything is gated on
// env vars, so nothing loads until the owner sets IDs from Sahara's OWN
// accounts (no agency containers):
//   NEXT_PUBLIC_GA4_ID                 e.g. G-74EZWDS33Z (Sahara GA4)
// Google Ads (AW-765890204) and its three conversion labels are fixed in lib/ads-conversions.ts (owner 2026-11-12):
// Booking Lead on form submit, WhatsApp click and Call click. NEXT_PUBLIC_GOOGLE_ADS_ID / _LEAD_LABEL are no longer read.
// Meta Pixel stays in app/book/page.tsx (NEXT_PUBLIC_META_PIXEL_ID).
//
// Only a submitted form counts as a lead. Call / WhatsApp taps are sent as
// separate events so they are never double-counted as form leads.

const GA4 = process.env.NEXT_PUBLIC_GA4_ID;
const ADS = GOOGLE_ADS_ID;
const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID;
// Google Tag Manager container from Sahara's own account (rebuild 2026-11-02). Optional — GA4 / Ads / Pixel above work without it;
// set it only if those tags are NOT also configured inside the container, or conversions double-count.
const GTM = process.env.NEXT_PUBLIC_GTM_ID && /^GTM-[A-Z0-9]{4,10}$/.test(process.env.NEXT_PUBLIC_GTM_ID) ? process.env.NEXT_PUBLIC_GTM_ID : null;
const LI_PARTNER = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID; // LinkedIn Insight Tag partner id (numeric)
const LI_CONVERSION = process.env.NEXT_PUBLIC_LINKEDIN_CONVERSION_ID; // optional: LinkedIn conversion rule id for a lead

type Gtag = (...args: unknown[]) => void;
const gtag = (): Gtag | null =>
  typeof window !== "undefined" && typeof (window as { gtag?: Gtag }).gtag === "function" ? (window as unknown as { gtag: Gtag }).gtag : null;
const fbq = (): Gtag | null =>
  typeof window !== "undefined" && typeof (window as { fbq?: Gtag }).fbq === "function" ? (window as unknown as { fbq: Gtag }).fbq : null;

function newEventId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  return c?.randomUUID ? c.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** _fbp / _fbc from the first-party cookies (the server falls back to the request cookies when these are absent). */
function metaIdsForServer(): { fbp?: string; fbc?: string } {
  try {
    const { fbp, fbc } = getMetaIds();
    return { ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}) };
  } catch {
    return {};
  }
}

/** Conversions API relay (the server adds IP / user agent / fbp / fbc). Fire-and-forget; skipped outside a browser page. */
function sendServerEvent(eventName: "Lead" | "Schedule" | "ViewContent" | "InitiateCheckout" | "Purchase" | "Contact", eventId: string, d: { category?: string; variant?: string; mobile?: string; value?: number }) {
  if (!PIXEL || typeof window === "undefined" || !window.location || typeof fetch !== "function") return;
  try {
    void fetch("/api/meta/capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, eventId, mobile: d.mobile, category: d.category, variant: d.variant, value: d.value, ...metaIdsForServer() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* tracking must never break the form */
  }
}

/** Fire once after a successful booking/lead form submission. */
export function trackLead(details: { category?: string; variant?: string; mobile?: string; /** Booking total in INR when the customer picked a priced package. */ value?: number; /** CRM lead / job number — dedupes the Ads conversion. */ id?: string; /** booking = priced slot booking, inquiry = inspection / quote request. */ kind?: "booking" | "inquiry" | "step1"; /** true when the CRM auto-confirmed the slot. */ confirmed?: boolean }) {
  // Owner-protected / internal numbers never reach any ad or analytics platform.
  if (isProtectedNumber(details.mobile)) return;
  // One shared id: the browser Pixel and the server (Conversions API) both send it, so Meta counts the lead once.
  const eventId = newEventId();
  const money = details.value && details.value > 0 ? { value: details.value, currency: "INR" } : {};
  // GTM-style event for every lead form (owner 2026-10-25): GA4 / Meta tags configured on `lead_form_submit` see all of them.
  if (typeof window !== "undefined") {
    const w = window as unknown as { dataLayer?: unknown[] };
    // GTM readiness (final sprint 2026-11-02): value, currency, transaction_id and event_id ride on the same push, so a GTM
    // Google Ads conversion / GA4 / Meta tag can read them as Data Layer Variables without code changes.
    (w.dataLayer = w.dataLayer || []).push({ event: "lead_form_submit", service_category: details.category, service_variant: details.variant, lead_type: details.kind ?? "lead", value: details.value && details.value > 0 ? details.value : undefined, currency: "INR", transaction_id: details.id || undefined, event_id: eventId, page_path: window.location.pathname });
    if (details.confirmed) w.dataLayer.push({ event: "booking_confirmed", service_category: details.category, value: details.value, currency: "INR", transaction_id: details.id || undefined });
  }
  fbq()?.("track", "Lead", { content_name: details.variant, content_category: details.category, ...money }, { eventID: eventId });
  sendServerEvent("Lead", eventId, details);
  const g = gtag();
  if (!g) return;
  g("event", "generate_lead", { service_category: details.category, service_variant: details.variant, lead_type: details.kind, ...money, ...(details.id ? { transaction_id: details.id } : {}) });
  // Google Ads "Booking Lead" (Primary): fires here, on the successful submit — never on page load. transaction_id is the CRM
  // lead id (or this submission's event id when the form has none) so Google never counts the same lead twice.
  fireAdsConversion("lead", { transactionId: details.id || eventId });
  // LinkedIn: one conversion per lead (only when the Insight Tag and a conversion id are configured).
  if (LI_CONVERSION && typeof window !== "undefined") (window as unknown as { lintrk?: (a: string, b: unknown) => void }).lintrk?.("track", { conversion_id: Number(LI_CONVERSION) });
}

/**
 * Standard ad-platform funnel events (owner 2026-11-12). All are no-ops until the matching NEXT_PUBLIC_* id is configured and
 * skip owner-protected numbers; each pushes to the GTM dataLayer too, so a GTM container can map them without code changes.
 *   ViewContent      service / locality page view          InitiateCheckout  "Book" clicked, step 1 opened
 *   Purchase         booking completed with its ₹ value    Contact           WhatsApp / Call click (see MarketingTags)
 */
function pushDl(event: string, data: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[] };
  (w.dataLayer = w.dataLayer || []).push({ event, ...data, page_path: window.location.pathname });
}
export function trackViewContent(d: { category?: string; name?: string; value?: number }) {
  const eventId = newEventId();
  const money = d.value && d.value > 0 ? { value: d.value, currency: "INR" } : {};
  pushDl("view_content", { service_category: d.category, content_name: d.name, ...money, event_id: eventId });
  fbq()?.("track", "ViewContent", { content_name: d.name, content_category: d.category, ...money }, { eventID: eventId });
  gtag()?.("event", "view_item", { items: [{ item_name: d.name, item_category: d.category, price: d.value }], ...money });
  sendServerEvent("ViewContent", eventId, { category: d.category, variant: d.name, value: d.value });
}
export function trackInitiateCheckout(d: { category?: string; name?: string; value?: number }) {
  const eventId = newEventId();
  const money = d.value && d.value > 0 ? { value: d.value, currency: "INR" } : {};
  pushDl("initiate_checkout", { service_category: d.category, content_name: d.name, ...money, event_id: eventId });
  fbq()?.("track", "InitiateCheckout", { content_name: d.name, content_category: d.category, ...money }, { eventID: eventId });
  gtag()?.("event", "begin_checkout", { items: [{ item_name: d.name, item_category: d.category, price: d.value }], ...money });
  sendServerEvent("InitiateCheckout", eventId, { category: d.category, variant: d.name, value: d.value });
}
export function trackPurchase(d: { category?: string; mobile?: string; value?: number; id?: string }) {
  if (isProtectedNumber(d.mobile)) return;
  const eventId = newEventId();
  const money = d.value && d.value > 0 ? { value: d.value, currency: "INR" } : {};
  pushDl("booking_purchase", { service_category: d.category, transaction_id: d.id || undefined, ...money, event_id: eventId });
  fbq()?.("track", "Purchase", { content_category: d.category, ...money }, { eventID: eventId });
  fbq()?.("track", "Schedule", { content_category: d.category });
  gtag()?.("event", "purchase", { transaction_id: d.id || undefined, ...money });
  sendServerEvent("Purchase", eventId, { category: d.category, mobile: d.mobile, value: d.value });
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
      const contact = contactKindOfHref(a.href);
      if (!contact) return;
      const kind = contact === "call" ? "call_click" : "whatsapp_click";
      gtag()?.("event", kind, { link_url: a.href, page_path: window.location.pathname });
      fireAdsConversion(contact); // Secondary Ads conversion, at the moment of the tap
      fbq()?.("track", "Contact", { method: kind === "call_click" ? "call" : "whatsapp" });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const pixel = withPixel && PIXEL;
  const linkedin = LI_PARTNER && /^\d{4,12}$/.test(LI_PARTNER) ? LI_PARTNER : null;
  if (!GA4 && !ADS && !pixel && !linkedin && !GTM) return null;
  const ids = [GA4, ADS].filter(Boolean) as string[];
  return (
    <>
      {/* Early connections for the tag hosts actually in use (React hoists these into <head>). */}
      {(GTM || ids.length > 0) && <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />}
      {pixel && <link rel="dns-prefetch" href="https://connect.facebook.net" />}
      {GTM && (
        <Script id="sahara-gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM}');`}
        </Script>
      )}
      {pixel && (
        <Script id="sahara-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL}');fbq('track','PageView');`}
        </Script>
      )}
      {linkedin && (
        <Script id="sahara-linkedin-insight" strategy="lazyOnload">
          {`window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push('${linkedin}');(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName('script')[0];var b=document.createElement('script');b.type='text/javascript';b.async=true;b.src='https://snap.licdn.com/li.lms-analytics/insight.min.js';s.parentNode.insertBefore(b,s);})(window.lintrk);`}
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
