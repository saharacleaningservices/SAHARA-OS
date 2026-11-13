"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the server data every 30 s while the tab is visible (no polling in the background). */
export function AutoRefresh({ everyMs = 30_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
