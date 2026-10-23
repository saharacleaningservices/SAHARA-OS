"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { customerConfirmWorkCompleted } from "@/server/actions/jobs";

/** Customer booking page: "Work completed" once the team has started. Sends the final invoice + Google review message. */
export function ConfirmCompletedButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  if (msg) return <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</p>;
  return (
    <div className="space-y-2 rounded-2xl bg-white p-5 text-sm shadow-sm">
      <p className="font-semibold text-[#0a2540]">Is the work finished?</p>
      <p className="text-xs text-[#0a2540]/70">Tap below once our team has completed the service. You will receive your invoice and a link to rate us.</p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await customerConfirmWorkCompleted(token);
            setMsg(res.success ? "Thank you! Your invoice and review link are on their way on WhatsApp." : res.error);
          })
        }
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        <CheckCircle2 className="size-4" /> {pending ? "Saving…" : "Mark Work Completed"}
      </button>
    </div>
  );
}
