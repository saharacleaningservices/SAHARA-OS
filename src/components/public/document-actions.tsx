"use client";

import { useEffect, useState } from "react";
import { Download, Share2, Wallet } from "lucide-react";

/** Download PDF plus Pay Now (customer quotation / invoice) or Share (crew card); hidden when printing. */
export function DocumentActions({ shareUrl, title, payHref = null, hideShare = false }: { shareUrl: string; title: string; payHref?: string | null; hideShare?: boolean }) {
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
    <div className={`grid gap-2 border-t border-[#0a2540]/10 p-4 print:hidden ${hideShare && !payHref ? "grid-cols-1" : "grid-cols-2"}`}>
      <button type="button" onClick={() => window.print()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white">
        <Download className="size-4" /> Download PDF
      </button>
      {payHref ? (
        <a href={payHref} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/40 text-sm font-bold text-primary">
          <Wallet className="size-4" /> Pay Now
        </a>
      ) : !hideShare ? (
        <button type="button" onClick={share} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/40 text-sm font-bold text-primary">
          <Share2 className="size-4" /> {copied ? "Link copied" : "Share"}
        </button>
      ) : null}
    </div>
  );
}
