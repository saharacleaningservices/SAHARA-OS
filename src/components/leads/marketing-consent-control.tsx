"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { recordMarketingConsent } from "@/server/actions/whatsapp-campaigns";

const LABEL = { OPTED_IN: "Opted in", OPTED_OUT: "Opted out", UNKNOWN: "Not recorded" } as const;

/** Shows a lead's WhatsApp marketing consent; Admin/Accounts can record the customer's explicit choice with a note (audit-logged). */
export function MarketingConsentControl({ leadId, consent, canEdit }: { leadId: string; consent: keyof typeof LABEL; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const save = (value: "OPTED_IN" | "OPTED_OUT") =>
    start(async () => {
      const res = await recordMarketingConsent({ leadId, consent: value, note });
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success("Consent recorded");
      setEditing(false);
      setNote("");
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <p className="font-medium text-foreground">
        {LABEL[consent]}
        {canEdit && !editing && (
          <button type="button" className="ml-2 text-xs font-semibold text-primary hover:underline" onClick={() => setEditing(true)}>
            Record
          </button>
        )}
      </p>
      {editing && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How the customer agreed, e.g. 'said yes to offers on call 29 Sep'"
            className="min-w-[240px] flex-1 rounded border px-2 py-1 text-sm"
          />
          <Button type="button" size="sm" disabled={pending} onClick={() => save("OPTED_IN")}>Opted in</Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => save("OPTED_OUT")}>Opted out</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
