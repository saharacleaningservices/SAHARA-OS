"use client";

import { useState, useTransition } from "react";
import { choosePayAfterService } from "@/server/actions/booking-page";

/** Records the customer's "pay after service" choice on their booking. */
export function PayAfterServiceButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await choosePayAfterService(token);
            setMsg("error" in res && res.error ? res.error : "Noted — you can pay after the service.");
          })
        }
        className="w-full rounded-xl border border-[#0a2540]/20 px-4 py-2.5 text-sm font-semibold text-[#0a2540] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Pay After Service"}
      </button>
      {msg && <p className="text-center text-xs text-[#0a2540]/70">{msg}</p>}
    </div>
  );
}
