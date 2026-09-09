"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Sahara Cleaning Services wordmark — the admin-uploaded logo if set, else
 * this bundled default. This file lives under /public and is committed to
 * the repo, so — unlike a logo uploaded at runtime through Settings — it
 * ships with every build and can never go missing after a redeploy. It's
 * the fallback every logo image on every page ultimately degrades to.
 */
// The official bundled brand mark. Drop the real PNG at
// public/brand/sahara-logo.png (transparent background, original proportions)
// and it becomes the default logo everywhere — no other change needed.
export const DEFAULT_LOGO_URL = "/brand/sahara-logo.png";
// Last-resort fallback that always exists in the repo.
const BUNDLED_FALLBACK = "/uploads/logo/sahara-logo.svg";

export function CompanyLogo({
  logoUrl,
  className,
  alt = "Sahara Cleaning Services",
}: {
  logoUrl?: string | null;
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState(logoUrl || DEFAULT_LOGO_URL);

  // Re-sync if the logoUrl prop changes (e.g. right after an admin saves a
  // new logo in Settings and the page re-fetches).
  useEffect(() => {
    setSrc(logoUrl || DEFAULT_LOGO_URL);
  }, [logoUrl]);

  return (
    <img
      src={src}
      alt={alt}
      className={cn("h-8 w-auto object-contain", className)}
      // If a custom-uploaded logo 404s (e.g. lost on a redeploy, since
      // Render's free tier has no persistent disk for runtime uploads),
      // fall back to the bundled default instead of showing a broken-image
      // icon. Guarded so a broken default itself can't loop forever.
      onError={() => {
        if (src !== DEFAULT_LOGO_URL && src !== BUNDLED_FALLBACK) setSrc(DEFAULT_LOGO_URL);
        else if (src === DEFAULT_LOGO_URL) setSrc(BUNDLED_FALLBACK);
      }}
    />
  );
}
