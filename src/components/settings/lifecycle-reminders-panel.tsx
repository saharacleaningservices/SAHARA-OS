"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runLifecycleSweepNow, sendReminderTestMessages } from "@/server/actions/lifecycle-reminders";

/** Super Admin controls: send the two templates to the approved QA number, or run one sweep now. */
export function LifecycleRemindersPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const test = () =>
    start(async () => {
      const r = await sendReminderTestMessages();
      if (!r.success) return void toast.error(r.error);
      if (r.errors.length) toast.error(r.errors.join(" · "));
      else toast.success(`${r.sent} test message(s) sent to the approved test number`);
      router.refresh();
    });
  const sweep = () =>
    start(async () => {
      const r = await runLifecycleSweepNow();
      if (!r.success) return void toast.error(r.error);
      const x = r.result;
      toast.success(r.result.note ?? `${x.sent} sent · ${x.blockedByMode} held back by the outbound mode · ${x.failed} failed`);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={test} disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Send test messages to the QA number
      </Button>
      <Button onClick={sweep} disabled={pending || !enabled} title={enabled ? undefined : "Set WHATSAPP_REMINDERS=on first"}>
        Run a sweep now
      </Button>
    </div>
  );
}
