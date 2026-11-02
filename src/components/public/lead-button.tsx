"use client";

import type { ReactNode } from "react";
import { openLead, type LeadIntent } from "@/components/public/bhk-price-cards";

/** Any button on a public page that opens the shared lead modal (mounted once by LandingShell). Usable from server components. */
export function LeadButton({ intent, className, children, ariaLabel }: { intent: LeadIntent; className?: string; children: ReactNode; ariaLabel?: string }) {
  return (
    <button type="button" aria-label={ariaLabel} onClick={() => openLead(intent)} className={className}>
      {children}
    </button>
  );
}
