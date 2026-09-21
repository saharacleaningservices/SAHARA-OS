"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Loader2, Lock, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validation";
import { requestPasswordReset, confirmPasswordReset } from "@/server/actions/password-reset";

const RESEND_COOLDOWN_SECONDS = 30;

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [otp, setOtp] = useState<{ id: string; ttl: number; expiresAt: number } | null>(null);
  const [lastValues, setLastValues] = useState<ForgotPasswordFormValues | null>(null);
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  // Live countdown to OTP expiry + a short resend cooldown, both ticking
  // from the same 1s interval while the OTP step is showing.
  useEffect(() => {
    if (!otp) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((otp.expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [otp]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  function startOtpStep(values: ForgotPasswordFormValues, ttlMinutes: number, otpId: string) {
    setLastValues(values);
    setOtp({ id: otpId, ttl: ttlMinutes, expiresAt: Date.now() + ttlMinutes * 60 * 1000 });
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setCode("");
  }

  async function onSubmit(values: ForgotPasswordFormValues) {
    setSubmitting(true);
    const res = await requestPasswordReset(values);
    setSubmitting(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    if ("otpRequired" in res && res.otpRequired) {
      startOtpStep(values, res.ttlMinutes, res.otpId);
      toast.message("Ask the Super Admin for the code", {
        description: `If this mobile number has an account, the Super Admin was just notified with a one-time code (valid ${res.ttlMinutes} min). Call them to get it.`,
      });
    }
  }

  async function resendOtp() {
    if (!lastValues || resendCooldown > 0) return;
    setResending(true);
    const res = await requestPasswordReset(lastValues);
    setResending(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    if ("otpRequired" in res && res.otpRequired) {
      startOtpStep(lastValues, res.ttlMinutes, res.otpId);
      toast.message("New code sent", { description: "The previous code no longer works." });
    }
  }

  async function submitOtp() {
    if (!otp) return;
    if (secondsLeft <= 0) {
      toast.error("This code has expired — resend a new one");
      return;
    }
    if (code.trim().length < 4) {
      toast.error("Enter the code from the Super Admin");
      return;
    }
    setSubmitting(true);
    const res = await confirmPasswordReset(otp.id, code.trim());
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Password reset. You can sign in now.");
    setDone(true);
  }

  if (done) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="size-6" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Password reset</h3>
          <p className="mt-1 text-sm text-muted-foreground">Your new password is active. Sign in below.</p>
        </div>
        <Link href="/login" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      </div>
    );
  }

  if (otp) {
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const ss = String(secondsLeft % 60).padStart(2, "0");
    return (
      <div className="w-full max-w-sm space-y-4">
        <div className="space-y-1">
          <Label htmlFor="otp-code">Super Admin OTP</Label>
          <Input
            id="otp-code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code"
            disabled={secondsLeft <= 0}
          />
          <p className={`text-xs ${secondsLeft <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {secondsLeft > 0 ? `Expires in ${mm}:${ss}` : "This code has expired — resend a new one"}
          </p>
        </div>
        <Button type="button" className="w-full" onClick={submitOtp} disabled={submitting || secondsLeft <= 0}>
          {submitting ? <Loader2 className="animate-spin" /> : <ShieldCheck className="size-4" />}
          Confirm & reset password
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={resendOtp}
          disabled={resending || resendCooldown > 0}
        >
          {resending ? <Loader2 className="animate-spin" /> : <RefreshCw className="size-4" />}
          {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : "Resend OTP"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setOtp(null);
            setCode("");
          }}
          className="block w-full text-center text-sm text-muted-foreground hover:underline"
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="mobile">Mobile Number</Label>
          <div className="relative">
            <Smartphone className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="mobile"
              type="text"
              inputMode="tel"
              autoComplete="username"
              placeholder="10-digit mobile number"
              className="pl-8"
              {...register("mobile")}
            />
          </div>
          {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPassword">New Password</Label>
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              className="pl-8"
              {...register("newPassword")}
            />
          </div>
          {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="pl-8"
              {...register("confirmPassword")}
            />
          </div>
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
        </div>

        <p className="text-xs text-muted-foreground">
          <KeyRound className="mr-1 inline size-3" />
          The Super Admin (Altaf) approves every reset with a one-time code before it takes effect.
        </p>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          Send reset request
        </Button>
      </form>

      <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </div>
  );
}
