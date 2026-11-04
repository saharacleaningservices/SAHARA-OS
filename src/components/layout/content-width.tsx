"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Page width (owner 2026-11-04): data-heavy registers use the FLUID layout — full width, so wide
 * tables (Parties, Vendor Operations) show every column on large screens without horizontal scroll.
 * Every other page keeps the BOXED 1280px column (max-w-7xl) for readable forms and dashboards.
 */
export const FLUID_PATHS = ["/customers", "/vendors"] as const;

export const isFluidPath = (pathname: string | null | undefined) =>
  FLUID_PATHS.some((p) => pathname === p || (pathname ?? "").startsWith(`${p}/`));

export function ContentWidth({ children }: { children: ReactNode }) {
  const fluid = isFluidPath(usePathname());
  return <div className={fluid ? "mx-auto w-full max-w-none" : "mx-auto max-w-7xl"}>{children}</div>;
}
