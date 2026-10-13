"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { completeStaffRegistration, sendStaffRegistrationOtp } from "@/server/actions/staff-registration";

/** First-time Staff App registration: mobile → SMS OTP → choose password/PIN → (office approval). */
export function StaffRegisterForm() {
  const [otpSent, setOtpSent] = useState(false);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (!otpSent) {
      const res = await sendStaffRegistrationOtp({ mobile });
      setBusy(false);
      if ("error" in res && res.error) return setError(res.error);
      setInfo("message" in res ? (res.message ?? null) : null);
      return setOtpSent(true);
    }
    const res = await completeStaffRegistration({ mobile, otp, password, confirmPassword });
    setBusy(false);
    if ("error" in res && res.error) return setError(res.error);
    setDone(
      "pendingApproval" in res && res.pendingApproval
        ? "Your mobile is verified. The office will approve your access soon — then sign in with your mobile number and the password you chose."
        : "You're registered. Sign in with your mobile number and the password you chose.",
    );
  }

  if (done) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <p className="text-sm">{done}</p>
        <Button asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reg-mobile">Registered mobile number</Label>
        <Input id="reg-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" placeholder="10-digit mobile" disabled={otpSent} />
      </div>
      {otpSent && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="reg-otp">OTP (6 digits)</Label>
            <Input id="reg-otp" value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
            {info && <p className="text-xs text-muted-foreground">{info}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-pass">Choose a password or PIN</Label>
            <PasswordInput id="reg-pass" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <p className="text-xs text-muted-foreground">A 4–6 digit PIN or a password of 6+ characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-pass2">Enter it again</Label>
            <PasswordInput id="reg-pass2" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </div>
        </>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} {otpSent ? "Register" : "Send OTP"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="text-primary">
          Sign in
        </Link>
        {" · "}
        <Link href="/staff-reset" className="text-primary">
          Forgot PIN
        </Link>
      </p>
    </form>
  );
}
