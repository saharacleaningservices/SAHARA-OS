"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cancelStaleWhatsApp, previewStaleWhatsApp } from "@/server/actions/whatsapp-queue";

type Preview = { total: number; counts: Record<string, number> };

/**
 * Admin tool to withdraw the never-sent WhatsApp backlog before the Cloud
 * API is connected, so Save & Connect doesn't flush weeks-old messages.
 * Shows counts first; cancelling marks rows CANCELLED (kept for audit).
 */
export function WhatsAppStaleQueueCard({ initial }: { initial: Preview }) {
  const [preview, setPreview] = useState(initial);
  const [pending, startTransition] = useTransition();

  function cancelAll() {
    if (!confirm(`Cancel ${preview.total} pending WhatsApp messages? They will never be sent.`)) return;
    startTransition(async () => {
      const res = await cancelStaleWhatsApp();
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(`Cancelled ${"count" in res ? res.count : 0} messages.`);
      const next = await previewStaleWhatsApp();
      if ("total" in next) setPreview({ total: next.total, counts: next.counts });
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Ban className="size-4 text-destructive" /> Pending WhatsApp queue
        </CardTitle>
        <span className="text-xs text-muted-foreground">{preview.total} pending</span>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {Object.entries(preview.counts).map(([k, v]) => (
            <span key={k} className="rounded-md bg-muted px-2 py-1 text-xs">
              {k}: <span className="font-semibold">{v}</span>
            </span>
          ))}
        </div>
        <Button type="button" size="sm" variant="destructive" onClick={cancelAll} disabled={pending || preview.total === 0}>
          {pending && <Loader2 className="size-4 animate-spin" />} Cancel stale queue
        </Button>
      </CardContent>
    </Card>
  );
}
