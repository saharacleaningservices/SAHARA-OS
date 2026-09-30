"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Sahara Cleaning Services logo. Single source of truth = the brand files
 * committed under /public/brand.
 *
 * - Default render = /brand/sahara-logo.svg (a real committed brand wordmark —
 *   always present, so there is never a broken-image flash).
 * - If the official raster /brand/sahara-logo.png is present it is used
 *   automatically (probed once on mount) — just drop the file, no code change.
 * - An admin-uploaded logo (Settings → `logoUrl`) always wins when set.
 * - Every fallback is guarded, so an image can never render broken.
 */
export const BRAND_PNG = "/brand/sahara-logo.png";
export const BRAND_SVG = "/brand/sahara-logo.svg";
const LAST_RESORT = "/uploads/logo/sahara-logo.svg";
export const DEFAULT_LOGO_URL = BRAND_SVG;

export function CompanyLogo({
  logoUrl,
  className,
  alt = "Sahara Cleaning Services",
  showTm = false,
}: {
  logoUrl?: string | null;
  className?: string;
  alt?: string;
  showTm?: boolean;
}) {
  const [src, setSrc] = useState(logoUrl || BRAND_SVG);

  useEffect(() => {
    if (logoUrl) {
      setSrc(logoUrl);
      return;
    }
    setSrc(BRAND_SVG);
    // Upgrade to the official PNG if it has been dropped into /public/brand.
    const probe = new Image();
    probe.onload = () => setSrc(BRAND_PNG);
    probe.src = BRAND_PNG;
  }, [logoUrl]);

  function handleError() {
    setSrc((cur) => (cur === BRAND_SVG ? LAST_RESORT : BRAND_SVG));
  }

  // The logo artwork carries its own ™ on the left, so no extra mark is
  // added (a second ™ on the right was a duplicate). `showTm` is kept only so
  // existing call sites compile.
  void showTm;
  return <img src={src} alt={alt} onError={handleError} className={cn("h-8 w-auto object-contain", className)} />;
}
