"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/utils";
import { reinstateWhatsAppNumber } from "@/server/actions/whatsapp-consent";

type OptedOutRow = {
  id: string;
  phoneNumber: string;
  optedOutAt: Date | null;
  optedOutVia: string | null;
  notes: string | null;
};

/**
 * Phase D — WhatsApp consent tracking. Lists every number that has opted
 * out (STOP reply, or set by hand) with a one-click reinstate. Shown on the
 * Message Log page (src/app/(app)/admin/whatsapp-log) — the same place
 * staff already look for send history, so opt-outs aren't a separate,
 * easy-to-forget surface.
 */
export function WhatsAppConsentCard({ optedOut }: { optedOut: OptedOutRow[] }) {
  const [pending, startTransition] = useTransition();

  function reinstate(phoneNumber: string) {
    startTransition(async () => {
      const res = await reinstateWhatsAppNumber(phoneNumber);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${phoneNumber} can receive WhatsApp messages again`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="size-4" /> WhatsApp Opt-outs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {optedOut.length === 0 ? (
          <EmptyState title="No opt-outs" description="Every number is currently subscribed." />
        ) : (
          <div className="space-y-1.5">
            {optedOut.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs"
              >
                <div>
                  <span className="font-medium text-foreground">{row.phoneNumber}</span>
                  <span className="ml-2 text-muted-foreground">
                    {row.optedOutAt ? formatDateTime(row.optedOutAt) : ""}
                    {row.optedOutVia === "CUSTOMER_REPLY" ? " · customer replied STOP" : row.optedOutVia === "MANUAL" ? " · set manually" : ""}
                  </span>
                </div>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => reinstate(row.phoneNumber)}>
                  Reinstate
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
