"use client";

import { FileText, MessageCircle, Printer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Job Card export bar. Field crew get the **team card** only (customer phone
 * hidden, Maps link kept). Office roles also get the **office card** with full
 * contact + payment details.
 */
export function JobCardActions({
  jobId,
  jobNumber,
  officeShareText,
  teamShareText,
  canSeeContact,
}: {
  jobId: string;
  jobNumber: string;
  officeShareText: string;
  teamShareText: string;
  canSeeContact: boolean;
}) {
  const pdfUrl = `/api/jobs/${jobId}/card/pdf`;
  const pdfTeamUrl = `${pdfUrl}?team=1`;

  function print() {
    const w = window.open(canSeeContact ? pdfUrl : pdfTeamUrl, "_blank");
    w?.addEventListener?.("load", () => {
      try {
        w.print();
      } catch {
        /* viewer handles it */
      }
    });
  }

  function share(text: string) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" asChild>
        <a href={`${(canSeeContact ? pdfUrl : pdfTeamUrl)}${canSeeContact ? "?download=1" : "&download=1"}`} download={`job-card-${jobNumber}.pdf`}>
          <FileText className="size-3.5" /> Download PDF
        </a>
      </Button>
      <Button variant="outline" size="sm" onClick={() => share(teamShareText)}>
        <Users className="size-3.5" /> Share to Team
      </Button>
      {canSeeContact && (
        <Button variant="outline" size="sm" onClick={() => share(officeShareText)}>
          <MessageCircle className="size-3.5" /> Office Card
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={print}>
        <Printer className="size-3.5" /> Print
      </Button>
    </div>
  );
}
