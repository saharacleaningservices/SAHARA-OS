"use client";

import { useEffect } from "react";
import { FaFacebookF, FaGoogle, FaInstagram, FaYoutube } from "react-icons/fa6";
import { Download, MessageCircle, Wallet } from "lucide-react";
import { BookingChangeRequest } from "@/components/public/booking-change-request";

/**
 * Sticky bottom action bar of the customer quotation / invoice view (owner 2026-10-25). Layout model: BOX MODEL — a fixed bar,
 * full width, at most one row of buttons plus one row of social icons, so it never reflows the A4 sheet above it.
 *   quotation: Pay Advance / Pay Now (primary blue) · Reschedule (outline blue) · Cancel (danger outline)
 *   invoice:   Download PDF · Share on WhatsApp
 * Hidden when printing / saving the page as PDF.
 */
export type DocActionBarProps = {
  kind: "QUOTATION" | "INVOICE";
  token: string;
  /** Quotation: label + link of the primary payment button; null hides it (nothing due / cancelled). */
  pay?: { label: string; href: string } | null;
  /** Quotation: show Reschedule / Cancel (booking still open). */
  canChange?: boolean;
  pdfHref?: string;
  shareText?: string;
  socials: { instagram: string; facebook: string; youtube: string; review: string };
};

export function DocActionBar({ kind, token, pay, canChange = false, pdfHref, shareText, socials }: DocActionBarProps) {
  // CRM "A4 PDF" button opens this page with ?print=1 — the browser's Save-as-PDF dialog opens by itself.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, []);
  const wa = `https://wa.me/?text=${encodeURIComponent(shareText ?? "")}`;
  const icon = "grid size-8 place-items-center rounded-full bg-[#1E40AF]/10 text-[#1E40AF] hover:bg-[#1E40AF] hover:text-white";
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1E40AF]/20 bg-white/95 shadow-[0_-4px_16px_rgba(30,64,175,0.12)] backdrop-blur print:hidden" role="region" aria-label="Document actions">
      <div className="mx-auto flex max-w-[794px] flex-col gap-2 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex flex-wrap items-stretch gap-2">
          {kind === "QUOTATION" ? (
            <>
              {pay ? (
                <a href={pay.href} className="flex min-h-11 flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-[#1E40AF] px-3 text-sm font-extrabold text-white">
                  <Wallet className="size-4" /> {pay.label}
                </a>
              ) : null}
              {canChange ? <BookingChangeRequest token={token} bar /> : null}
            </>
          ) : (
            <>
              <a href={pdfHref} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1E40AF] px-3 text-sm font-extrabold text-white">
                <Download className="size-4" /> Download PDF
              </a>
              <a href={wa} target="_blank" rel="noreferrer" className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-sm font-extrabold text-white">
                <MessageCircle className="size-4" /> Share on WhatsApp
              </a>
            </>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <a href={socials.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className={icon}><FaInstagram className="size-4" /></a>
          <a href={socials.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className={icon}><FaFacebookF className="size-3.5" /></a>
          <a href={socials.youtube} target="_blank" rel="noreferrer" aria-label="YouTube" className={icon}><FaYoutube className="size-4" /></a>
          <a href={socials.review} target="_blank" rel="noreferrer" aria-label="Google Review" className={icon}><FaGoogle className="size-3.5" /></a>
        </div>
      </div>
    </div>
  );
}
