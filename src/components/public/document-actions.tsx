"use client";

import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";

/** Print / Save as PDF and Share for the customer quotation or invoice (hidden when printing). */
export function DocumentActions({ shareUrl, title }: { shareUrl: string; title: string }) {
  const [copied, setCopied] = useState(false);
  // CRM "A4 PDF" button opens this page with ?print=1 — the browser's Save-as-PDF dialog (A4, print layout) opens by itself.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, []);
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // share sheet dismissed — nothing to do
    }
  }
  return (
    <div className="grid grid-cols-2 gap-2 border-t border-[#0a2540]/10 p-4 print:hidden">
      <button type="button" onClick={() => window.print()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white">
        <Download className="size-4" /> Download PDF
      </button>
      <button type="button" onClick={share} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/40 text-sm font-bold text-primary">
        <Share2 className="size-4" /> {copied ? "Link copied" : "Share"}
      </button>
    </div>
  );
}
