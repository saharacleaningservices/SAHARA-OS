"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setGpsTracking } from "@/server/actions/tracking";

/** Super Admin only (the page is ADMIN-gated and the action refuses everyone else). */
export function TrackingSwitch({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className={`min-h-11 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-60 ${enabled ? "bg-red-600" : "bg-success"}`}
      onClick={() => start(async () => { const r = await setGpsTracking(!enabled); if ("error" in r && r.error) return void toast.error(r.error); router.refresh(); })}>
      {enabled ? "Turn tracking OFF" : "Turn tracking ON"}
    </button>
  );
}
