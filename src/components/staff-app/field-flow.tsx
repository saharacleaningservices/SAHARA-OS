"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MapPinCheck, ShieldCheck, CheckCircle2 } from "lucide-react";
import { staffReachedLocation, staffUpdateJobStatus, staffVerifyStartOtp, staffCompleteJob } from "@/server/actions/jobs";
import { PhotoUploader } from "@/components/jobs/photo-uploader";
import { cn } from "@/lib/utils";

type Labels = Record<
  | "onTheWay" | "reached" | "reachedHint" | "locating" | "otpTitle" | "otpHint" | "verify" | "afterPhotos" | "photosNeed" | "billed"
  | "collected" | "mode" | "modeUpi" | "modeCash" | "modeBank" | "modePending" | "reason" | "complete" | "done",
  string
>;

const MODES = [
  ["UPI", "modeUpi"],
  ["CASH", "modeCash"],
  ["BANK", "modeBank"],
  ["PENDING_APPROVAL", "modePending"],
] as const;

/** Browser GPS read with accuracy; resolves a reason string on failure so the staff member can act on it. */
function readGps(): Promise<{ lat: number; lng: number; acc: number } | string> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve("This phone has no GPS support.");
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      (e) => resolve(e.code === 1 ? "Location permission is off. Allow Location for this app and try again." : "Could not get your location. Go outside and try again."),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

/**
 * Field flow for today's own job: (On the way) → Reached Location (GPS) → customer 4-digit start code → after-photos + exact payment → Complete.
 * Every gate is enforced again on the server (src/server/actions/jobs.ts); this component only guides the order.
 */
export function StaffFieldFlow({
  jobId, status, reached, otpVerified, afterPhotos, billedAmount, directionsHref, labels,
}: {
  jobId: string; status: string; reached: boolean; otpVerified: boolean; afterPhotos: number; billedAmount: number | null; directionsHref?: string; labels: Labels;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState("");
  const [amount, setAmount] = useState(billedAmount != null ? String(billedAmount) : "");
  const [mode, setMode] = useState<(typeof MODES)[number][0] | "">("");
  const [note, setNote] = useState("");

  if (status === "COMPLETED") {
    return <div className="flex items-center gap-2 rounded-2xl bg-success/15 p-4 text-sm font-semibold text-success"><CheckCircle2 className="size-5" /> {labels.done}</div>;
  }

  async function onReached() {
    setBusy(true);
    try {
      const gps = await readGps();
      if (typeof gps === "string") return void toast.error(gps);
      const res = await staffReachedLocation(jobId, gps);
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(labels.reached);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const card = "space-y-3 rounded-2xl border border-border bg-card p-4";
  const big = "min-h-12 w-full rounded-xl text-base font-bold disabled:opacity-60";

  // 1) Not at the site yet
  if (!reached) {
    return (
      <section className={card}>
        {status !== "ON_THE_WAY" && (
          <button
            type="button"
            disabled={pending}
            className={cn(big, "bg-muted text-foreground")}
            onClick={() => {
              if (directionsHref) window.open(directionsHref, "_blank", "noopener");
              start(async () => {
                const res = await staffUpdateJobStatus(jobId, "ON_THE_WAY");
                if ("error" in res && res.error) return void toast.error(res.error);
                router.refresh();
              });
            }}
          >
            {labels.onTheWay}
          </button>
        )}
        <button type="button" disabled={busy} onClick={onReached} className={cn(big, "flex items-center justify-center gap-2 bg-primary text-primary-foreground")}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : <MapPinCheck className="size-5" />} {busy ? labels.locating : labels.reached}
        </button>
        <p className="text-xs text-muted-foreground">{labels.reachedHint}</p>
      </section>
    );
  }

  // 2) At the site, waiting for the customer's start code
  if (!otpVerified && status !== "STARTED") {
    return (
      <section className={card}>
        <h2 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="size-4 text-primary" /> {labels.otpTitle}</h2>
        <p className="text-xs text-muted-foreground">{labels.otpHint}</p>
        <input
          inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="••••" aria-label={labels.otpTitle}
          className="h-14 w-full rounded-xl border border-border bg-background text-center font-mono text-3xl font-extrabold tracking-[0.6em]"
        />
        <button
          type="button" disabled={pending || otp.length !== 4} className={cn(big, "bg-primary text-primary-foreground")}
          onClick={() => start(async () => {
            const res = await staffVerifyStartOtp(jobId, otp);
            if ("error" in res && res.error) return void toast.error(res.error);
            setOtp("");
            router.refresh();
          })}
        >
          {pending ? "…" : labels.verify}
        </button>
      </section>
    );
  }

  // 3) Work in progress → completion gate
  const needReason = mode === "PENDING_APPROVAL";
  const ready = afterPhotos >= 1 && mode !== "" && amount !== "" && (!needReason || note.trim().length >= 5);
  return (
    <section className={card}>
      <h2 className="text-sm font-bold">{labels.afterPhotos} <span className={cn("ml-1 rounded-full px-2 py-0.5 text-xs", afterPhotos >= 1 ? "bg-success/15 text-success" : "bg-amber-100 text-amber-800")}>{afterPhotos >= 1 ? `${afterPhotos} ✓` : labels.photosNeed}</span></h2>
      <PhotoUploader jobId={jobId} type="AFTER" />

      {billedAmount != null && <div className="rounded-xl bg-muted px-3 py-2 text-sm">{labels.billed}: <b>₹{billedAmount.toLocaleString("en-IN")}</b></div>}

      <label className="block text-sm font-semibold">
        {labels.collected}
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3 text-lg font-bold" />
      </label>

      <div>
        <div className="mb-1 text-sm font-semibold">{labels.mode}</div>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map(([value, key]) => (
            <button key={value} type="button" onClick={() => setMode(value)} className={cn("min-h-11 rounded-xl border px-2 text-sm font-semibold", mode === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>
              {labels[key]}
            </button>
          ))}
        </div>
      </div>

      {(needReason || note) && (
        <label className="block text-sm font-semibold">
          {needReason ? labels.reason : "Note"}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm" />
        </label>
      )}

      <button
        type="button" disabled={pending || !ready} className={cn(big, "bg-success text-white")}
        onClick={() => start(async () => {
          const res = await staffCompleteJob(jobId, { amount: Number(amount), mode, note });
          if ("error" in res && res.error) return void toast.error(res.error);
          toast.success(labels.done);
          router.refresh();
        })}
      >
        {pending ? "…" : labels.complete}
      </button>
    </section>
  );
}
