"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MapPinCheck, ShieldCheck, CheckCircle2 } from "lucide-react";
import { staffReachedLocation, staffUpdateJobStatus, staffVerifyStartOtp, staffCompleteJob } from "@/server/actions/jobs";
import { cn } from "@/lib/utils";

type Labels = Record<
  | "onTheWay" | "reached" | "reachedHint" | "locating" | "otpTitle" | "otpHint" | "verify" | "collectClose" | "total" | "advance" | "balance" | "payQr" | "reviewQr"
  | "collected" | "mode" | "modeUpi" | "modeCash" | "modeBank" | "modePending" | "reason" | "complete" | "done" | "includes" | "upiConfirm" | "shareProof" | "cashTag",
  string
>;

// Payment gate (owner 2026-11-14): a technician closes a job with exactly one of these two. No manual UTR typing.
const MODES = [
  ["UPI", "modeUpi"],
  ["CASH", "modeCash"],
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
 * Field flow for today's own job: (On the way) → Reached Location (GPS) → customer 4-digit start code → Collect Payment & Close Job (payment confirmation only, no photos).
 * Every gate is enforced again on the server (src/server/actions/jobs.ts); this component only guides the order.
 */
export function StaffFieldFlow({
  jobId, status, reached, otpVerified, bill, payQr, reviewQr, directionsHref, labels, staffName, lines,
}: {
  staffName?: string; lines?: string[];
  jobId: string; status: string; reached: boolean; otpVerified: boolean; bill: { total: number; advance: number; balance: number } | null; payQr: string | null; reviewQr: string | null; directionsHref?: string; labels: Labels;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState("");
  const [amount, setAmount] = useState(bill ? String(bill.balance) : "");
  const [mode, setMode] = useState<(typeof MODES)[number][0] | "">("");
  const [note] = useState("");
  const [closing, setClosing] = useState(false);
  const [upiOk, setUpiOk] = useState(false);

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
  const big = "min-h-14 w-full rounded-2xl text-lg font-bold disabled:opacity-60";

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

  // 3) Work in progress → one big action card, then the payment screen
  if (!closing) {
    return (
      <section className={card}>
        <button type="button" onClick={() => setClosing(true)} className={cn(big, "min-h-20 bg-success text-xl text-white")}>{labels.collectClose}</button>
      </section>
    );
  }
  const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const ready = mode !== "" && amount !== "" && Number(amount) > 0 && (mode !== "UPI" || upiOk);
  const shareHref = `https://wa.me/?text=${encodeURIComponent(`Payment received for the job — ${money(Number(amount) || 0)} via UPI${staffName ? ` (${staffName})` : ""}. Screenshot attached.`)}`;
  return (
    <section className={card}>
      {lines && lines.length > 0 && (
        <div className="rounded-2xl border border-border p-3 text-sm"><div className="mb-1 font-semibold">{labels.includes}</div><ul className="list-disc space-y-0.5 pl-5">{lines.map((l, i) => <li key={`${l}-${i}`}>{l}</li>)}</ul></div>
      )}
      {bill && (
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-baseline justify-between rounded-2xl bg-muted px-4 py-3"><span className="text-base font-semibold">{labels.total}</span><span className="text-3xl font-extrabold">{money(bill.total)}</span></div>
          <div className="flex items-baseline justify-between rounded-2xl bg-muted px-4 py-3"><span className="text-base font-semibold">{labels.advance}</span><span className="text-3xl font-extrabold">{money(bill.advance)}</span></div>
          <div className="flex items-baseline justify-between rounded-2xl bg-primary px-4 py-3 text-primary-foreground"><span className="text-base font-bold">{labels.balance}</span><span className="text-4xl font-extrabold">{money(bill.balance)}</span></div>
        </div>
      )}

      {(payQr || reviewQr) && (
        <div className="grid grid-cols-2 gap-3">
          {payQr && (<figure className="text-center"><img src={payQr} alt={labels.payQr} className="mx-auto w-full rounded-xl border border-border bg-white p-1" /><figcaption className="mt-1 text-xs font-semibold">{labels.payQr}</figcaption></figure>)}
          {reviewQr && (<figure className="text-center"><img src={reviewQr} alt={labels.reviewQr} className="mx-auto w-full rounded-xl border border-border bg-white p-1" /><figcaption className="mt-1 text-xs font-semibold">{labels.reviewQr}</figcaption></figure>)}
        </div>
      )}

      <label className="block text-sm font-semibold">
        {labels.collected}
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="mt-1 h-14 w-full rounded-xl border border-border bg-background px-3 text-2xl font-extrabold" />
      </label>

      <div>
        <div className="mb-1 text-sm font-semibold">{labels.mode}</div>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map(([value, key]) => (
            <button key={value} type="button" onClick={() => setMode(value)} className={cn("min-h-14 rounded-2xl border px-2 text-base font-bold", mode === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>
              {labels[key]}
            </button>
          ))}
        </div>
      </div>

      {mode === "UPI" && (
        <div className="space-y-2 rounded-2xl border border-border p-3">
          <label className="flex items-start gap-3 text-sm font-semibold">
            <input type="checkbox" checked={upiOk} onChange={(e) => setUpiOk(e.target.checked)} className="mt-0.5 size-6 shrink-0" />
            <span>{labels.upiConfirm}</span>
          </label>
          <a href={shareHref} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-background px-3 text-sm font-bold">{labels.shareProof}</a>
        </div>
      )}
      {mode === "CASH" && <p className="rounded-2xl bg-muted px-3 py-2 text-sm font-semibold">{labels.cashTag}{staffName ? `: ${staffName}` : ""}</p>}

      <button
        type="button" disabled={pending || !ready} className={cn(big, "bg-success text-white")}
        onClick={() => start(async () => {
          const res = await staffCompleteJob(jobId, { amount: Number(amount), mode, note, upiConfirmed: upiOk });
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
