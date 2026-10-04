"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Notification links point at an exact record (/my/day/…#adv-<id>). CSS
 * :target doesn't fire on client-side navigation, so scroll to the record and
 * flash a highlight ring here instead.
 */
export function HashHighlight() {
  const pathname = usePathname();
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "bg-accent", "rounded-xl");
    const t = setTimeout(() => el.classList.remove("bg-accent"), 2500);
    return () => clearTimeout(t);
  }, [pathname]);
  return null;
}
