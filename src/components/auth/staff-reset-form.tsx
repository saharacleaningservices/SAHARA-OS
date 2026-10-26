"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { requestStaffPinReset, resetStaffPinWithOtp, sendStaffPinOtp } from "@/server/actions/staff-pin-reset";

/**
 * Forgot PIN: 1) OTP by SMS to the registered mobile → set a new PIN.
 * 2) If OTP isn't available / doesn't arrive → ask the office (Super Admin / Accounts approve).
 * The existing PIN is never shown anywhere.
 */
export function StaffResetForm() {
  const [mode, setMode] = useState<"otp" | "office">("otp");
  const [otpSent, setOtpSent] = useState(false);
  const [mobile, setMobile] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function sendOtp() {
    setError(null);
    setBusy(true);
    const res = await sendStaffPinOtp({ mobile, employeeCode: employeeCode || undefined });
    setBusy(false);
    if ("error" in res && res.error) {
      setError(res.error);
      if ("fallback" in res && res.fallback) setMode("office");
      return;
    }
    setInfo("message" in res ? res.message : null);
    setOtpSent(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "otp" && !otpSent) return void sendOtp();
    setBusy(true);
    const res =
      mode === "otp"
        ? await resetStaffPinWithOtp({ mobile, otp, newPin, confirmPin })
        : await requestStaffPinReset({ mobile, employeeCode: employeeCode || undefined, newPin, confirmPin });
    setBusy(false);
    if ("error" in res && res.error) return setError(res.error);
    setDone(mode === "otp" ? "Your new PIN is set. Sign in with it now." : "message" in res ? (res.message ?? "Request sent.") : "Request sent.");
  }

  if (done) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <p className="text-sm">{done}</p>
        {mode === "office" && <p className="text-xs text-muted-foreground">The office may call you to confirm. Once approved, sign in with your new PIN.</p>}
        <Button asChild className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  const showPins = mode === "office" || otpSent;
  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-semibold">
        <button type="button" onClick={() => setMode("otp")} className={`rounded-md py-2 ${mode === "otp" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
          OTP on my mobile
        </button>
        <button type="button" onClick={() => setMode("office")} className={`rounded-md py-2 ${mode === "office" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
          Ask the office to reset
        </button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-mobile">Registered mobile number</Label>
        <Input id="sr-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" placeholder="10-digit mobile" disabled={otpSent && mode === "otp"} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-code">Employee code (optional)</Label>
        <Input id="sr-code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} autoCapitalize="characters" placeholder="e.g. SCS-0007" disabled={otpSent && mode === "otp"} />
      </div>
      {mode === "otp" && otpSent && (
        <div className="space-y-1.5">
          <Label htmlFor="sr-otp">OTP (6 digits)</Label>
          <Input id="sr-otp" value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
          {info && <p className="text-xs text-muted-foreground">{info}</p>}
        </div>
      )}
      {showPins && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="sr-pin">New PIN (4–6 digits)</Label>
            <PasswordInput id="sr-pin" value={newPin} onChange={(e) => setNewPin(e.target.value)} autoComplete="new-password" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sr-pin2">New PIN again</Label>
            <PasswordInput id="sr-pin2" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} autoComplete="new-password" inputMode="numeric" />
          </div>
        </>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} {mode === "otp" ? (otpSent ? "Set new PIN" : "Send OTP") : "Send reset request"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {mode === "office" ? "Your new PIN starts working after the office approves the request. " : "No OTP? Use “Ask the office to reset”. "}
        <Link href="/login" className="text-primary">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
