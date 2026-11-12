"use client";

import { useEffect } from "react";
import type { AttributionPayload } from "@/lib/attribution";
import { appendRefToWhatsAppUrl, refCodeForTouch } from "@/lib/source-label";

// Adds the visitor's attribution tag to every WhatsApp button on the public site (owner 2026-11-12): the pre-filled message
// ends with "[Ref: GOOGLE-G1]" / "[Ref: GMB-MAGARPATTA]" / "[Ref: SEO-<page>]", and the WhatsApp webhook turns that into the
// lead's source tag. Done in the browser so the server HTML (and the Cloudflare-cached copy) stays identical for everyone.
// A direct / untracked visitor gets no tag. One listener per page, however many components ask for it.

type Flagged = Window & { __saharaWaRefTagger?: boolean };

function currentCode(getPayload: () => AttributionPayload): string | null {
  try {
    const a = getPayload();
    return refCodeForTouch(a.latest ?? a.first ?? null, window.location.pathname);
  } catch {
    return null;
  }
}

function tag(a: HTMLAnchorElement, code: string) {
  const href = a.getAttribute("href");
  if (!href || !/^https?:/i.test(href)) return;
  const next = appendRefToWhatsAppUrl(href, code);
  if (next) a.setAttribute("href", next);
}

/** getPayload is attribution-capture's getAttributionPayload (passed in so the two files do not import each other). */
export function useWhatsAppRefTagger(getPayload: () => AttributionPayload) {
  useEffect(() => {
    const w = window as Flagged;
    if (w.__saharaWaRefTagger) return;
    w.__saharaWaRefTagger = true;
    // Existing buttons: tagged up front so a long-press "copy link" carries the tag too.
    const code = currentCode(getPayload);
    if (code) document.querySelectorAll<HTMLAnchorElement>("a[href*='wa.me'], a[href*='whatsapp.com']").forEach((a) => tag(a, code));
    // Buttons that appear later (modals, sticky bars), and the attribution cookie changing mid-visit: tag at click time.
    const onClick = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const c = currentCode(getPayload);
      if (c) tag(a, c);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      w.__saharaWaRefTagger = false;
    };
  }, [getPayload]);
}
