"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Sahara Cleaning Services logo. Single source of truth = the brand files
 * committed under /public/brand.
 *
 * - Default render = /brand/sahara-logo@2x.png, the official artwork (830 px, transparent, ~36 KB) — sharp on
 *   high-density phone screens and rendered from the very first paint (no swap from a look-alike).
 * - An admin-uploaded logo (Settings → `logoUrl`) always wins when set.
 * - If an image fails: the older 415 px PNG, then the vector wordmark, then the last-resort badge —
 *   it can never render broken.
 * - Dark mode: sits on a small white chip so the blue / grey artwork stays readable.
 */
export const BRAND_PNG = "/brand/sahara-logo@2x.png";
export const BRAND_PNG_SMALL = "/brand/sahara-logo.png";
export const BRAND_SVG = "/brand/sahara-logo.svg";
const LAST_RESORT = "/uploads/logo/sahara-logo.svg";
export const DEFAULT_LOGO_URL = BRAND_PNG;
const FALLBACKS = [BRAND_PNG, BRAND_PNG_SMALL, BRAND_SVG, LAST_RESORT];

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
  const [src, setSrc] = useState(logoUrl || BRAND_PNG);

  useEffect(() => {
    setSrc(logoUrl || BRAND_PNG);
  }, [logoUrl]);

  function handleError() {
    setSrc((cur) => {
      const i = FALLBACKS.indexOf(cur);
      return i === -1 ? FALLBACKS[0] : (FALLBACKS[i + 1] ?? cur);
    });
  }

  // The logo artwork carries its own ™ on the left, so no extra mark is
  // added (a second ™ on the right was a duplicate). `showTm` is kept only so
  // existing call sites compile.
  void showTm;
  return (
    <img
      src={src}
      alt={alt}
      onError={handleError}
      decoding="async"
      className={cn("h-8 w-auto object-contain", !className?.includes("invert") && "dark:rounded-md dark:bg-white dark:px-1", className)}
    />
  );
}
