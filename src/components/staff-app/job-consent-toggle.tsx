"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { staffRecordJobConsent } from "@/server/actions/jobs";

type Labels = { title: string; hint: string; record: string; ask: string; done: string; out: string };

/** One-tap "customer agreed to WhatsApp offers" for the crew. One-way: staff can't opt a customer out or undo. */
export function StaffJobConsentToggle({ jobId, consent, disabled, labels }: { jobId: string; consent: string; disabled?: boolean; labels: Labels }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const optedIn = consent === "OPTED_IN";
  const optedOut = consent === "OPTED_OUT";

  return (
    <section className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="min-w-0">
        <div className="text-sm font-bold">{labels.title}</div>
        <div className="text-xs text-muted-foreground">{optedOut ? labels.out : labels.hint}</div>
      </div>
      {optedOut ? null : optedIn ? (
        <span className="shrink-0 rounded-xl bg-success/15 px-3 py-2 text-sm font-bold text-success">{labels.done}</span>
      ) : (
        <button
          type="button"
          disabled={pending || disabled}
          onClick={() => {
            if (!window.confirm(labels.ask)) return;
            start(async () => {
              const res = await staffRecordJobConsent(jobId);
              if ("error" in res && res.error) return void toast.error(res.error);
              toast.success(labels.done);
              router.refresh();
            });
          }}
          className="min-h-11 shrink-0 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "…" : labels.record}
        </button>
      )}
    </section>
  );
}
