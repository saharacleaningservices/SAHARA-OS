"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, ChevronDown, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { bulkCreateBookingLinks } from "@/server/actions/booking-links";

type Kind = "BOOKING_FORM" | "FOLLOWUP" | "REVIEW";
const LABEL: Record<Kind, string> = {
  BOOKING_FORM: "Send Booking Form",
  FOLLOWUP: "Send Follow-up",
  REVIEW: "Send Review Request",
};

export function BulkOutreachButton({
  customers,
}: {
  customers: { id: string; name: string; mobile: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<{ name: string; mobile: string; waUrl: string }[] | null>(null);

  function run(kind: Kind) {
    if (customers.length === 0) return;
    startTransition(async () => {
      const res = await bulkCreateBookingLinks(
        kind,
        customers.map((c) => ({ name: c.name, mobile: c.mobile, leadId: c.id })),
      );
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setResults(res.results);
      toast.success(`${res.count} ${LABEL[kind].toLowerCase()} link(s) created & queued`);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Outreach <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(Object.keys(LABEL) as Kind[]).map((k) => (
            <DropdownMenuItem key={k} onClick={() => run(k)}>{LABEL[k]}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={results !== null} onOpenChange={(o) => !o && setResults(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Links created & queued</DialogTitle>
            <DialogDescription>
              Each message is queued for the WhatsApp Cloud API. Until it&apos;s connected, open each chat below to send
              from your own WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {results?.map((r) => (
              <a
                key={r.mobile}
                href={r.waUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm hover:bg-muted/40"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{r.mobile}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
                  <MessageCircle className="size-3.5" /> Open
                </span>
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
