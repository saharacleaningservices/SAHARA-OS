"use client";

import { FileText, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Job Card export bar — Download PDF, share the card text on WhatsApp, or
 * print. The PDF is generated server-side at /api/jobs/[id]/card/pdf; the
 * WhatsApp text is pre-built on the server and passed in as `shareText`.
 */
export function JobCardActions({
  jobId,
  jobNumber,
  shareText,
}: {
  jobId: string;
  jobNumber: string;
  shareText: string;
}) {
  const pdfUrl = `/api/jobs/${jobId}/card/pdf`;

  function print() {
    const w = window.open(pdfUrl, "_blank");
    // Most browsers open the PDF viewer which has its own print button; also
    // try to trigger print once it loads.
    w?.addEventListener?.("load", () => {
      try {
        w.print();
      } catch {
        /* viewer handles it */
      }
    });
  }

  function whatsapp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" asChild>
        <a href={`${pdfUrl}?download=1`} download={`job-card-${jobNumber}.pdf`}>
          <FileText className="size-3.5" /> Download PDF
        </a>
      </Button>
      <Button variant="outline" size="sm" onClick={whatsapp}>
        <MessageCircle className="size-3.5" /> WhatsApp Share
      </Button>
      <Button variant="outline" size="sm" onClick={print}>
        <Printer className="size-3.5" /> Print
      </Button>
    </div>
  );
}
