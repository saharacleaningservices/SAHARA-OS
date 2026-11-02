"use client";

import { useState } from "react";
import { KeyRound, Search } from "lucide-react";
import { checkTrackCode, sendTrackCode } from "@/server/actions/order-track";

/** /track form: Job ID + mobile → 6-digit WhatsApp code → opens the booking page. */
export function TrackForm() {
  const [step, setStep] = useState<"ask" | "code">("ask");
  const [jobNumber, setJobNumber] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const input = "mt-1 min-h-12 w-full rounded-2xl border-2 border-[#0a2540]/10 bg-white px-3.5 text-base outline-none focus:border-primary";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const r = await sendTrackCode(jobNumber, mobile).catch(() => ({ ok: false as const, error: "No connection. Please try again." }));
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setMsg(r.message); setStep("code");
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const r = await checkTrackCode(jobNumber, mobile, code).catch(() => ({ ok: false as const, error: "No connection. Please try again." }));
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    window.location.assign(r.url);
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      {step === "ask" ? (
        <form onSubmit={send} className="space-y-3" noValidate>
          <label className="block text-sm font-bold">Job ID<input value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} placeholder="JOB-2026-0123" autoCapitalize="characters" className={input} /></label>
          <label className="block text-sm font-bold">Mobile number<input value={mobile} onChange={(e) => setMobile(e.target.value)} type="tel" inputMode="numeric" maxLength={14} placeholder="Used for the booking" className={input} /></label>
          {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{err}</p>}
          <button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-extrabold text-white disabled:opacity-60"><Search className="size-5" />{busy ? "Sending…" : "Get code on WhatsApp"}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3" noValidate>
          <p className="rounded-2xl bg-[#eef4fb] p-3 text-sm">{msg}</p>
          <label className="block text-sm font-bold">6-digit code<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" className={`${input} text-center text-2xl tracking-[0.5em]`} /></label>
          {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{err}</p>}
          <button disabled={busy || code.length !== 6} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-extrabold text-white disabled:opacity-60"><KeyRound className="size-5" />{busy ? "Checking…" : "Track my order"}</button>
          <button type="button" onClick={() => { setStep("ask"); setCode(""); setErr(""); }} className="w-full text-sm font-bold text-primary">Change details / resend code</button>
        </form>
      )}
    </div>
  );
}
