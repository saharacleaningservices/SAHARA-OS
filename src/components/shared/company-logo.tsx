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
export const DEFAULT_LOGO_URL = "/uploads/logo/sahara-logo.svg";

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
        if (src !== DEFAULT_LOGO_URL) setSrc(DEFAULT_LOGO_URL);
      }}
    />
  );
}
