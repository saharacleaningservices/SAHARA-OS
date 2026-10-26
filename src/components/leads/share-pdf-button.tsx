"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Share PDF": the customer's short link to the A4 PDF — the phone's share sheet where there is one, else copied to the clipboard. */
export function SharePdfButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (navigator.share) return void (await navigator.share({ title, url }));
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* share sheet dismissed */
    }
  }
  return (
    <Button size="sm" onClick={share}>
      <Share2 className="size-3.5" /> {copied ? "Link copied" : "Share PDF"}
    </Button>
  );
}
