"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RefreshCw, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotLoginIdSchema, type ForgotLoginIdFormValues } from "@/lib/validation";
import { requestLoginIdRecovery, confirmLoginIdRecovery } from "@/server/actions/login-id-recovery";

const RESEND_COOLDOWN_SECONDS = 30;

export function ForgotLoginIdForm() {
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [otp, setOtp] = useState<{ id: string; expiresAt: number } | null>(null);
  const [lastValues, setLastValues] = useState<ForgotLoginIdFormValues | null>(null);
  const [code, setCode] = useState("");
  const [revealedLoginId, setRevealedLoginId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotLoginIdFormValues>({ resolver: zodResolver(forgotLoginIdSchema) });

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

  function startOtpStep(values: ForgotLoginIdFormValues, ttlMinutes: number, otpId: string) {
    setLastValues(values);
    setOtp({ id: otpId, expiresAt: Date.now() + ttlMinutes * 60 * 1000 });
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setCode("");
  }

  async function onSubmit(values: ForgotLoginIdFormValues) {
    setSubmitting(true);
    const res = await requestLoginIdRecovery(values);
    setSubmitting(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    startOtpStep(values, res.ttlMinutes, res.otpId);
    toast.message("Ask the Super Admin for the code", {
      description: `If that name matches an account, the Super Admin was just notified with a one-time code (valid ${res.ttlMinutes} min). Call them to get it.`,
    });
  }

  async function resendOtp() {
    if (!lastValues || resendCooldown > 0) return;
    setResending(true);
    const res = await requestLoginIdRecovery(lastValues);
    setResending(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    startOtpStep(lastValues, res.ttlMinutes, res.otpId);
    toast.message("New code sent", { description: "The previous code no longer works." });
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
    const res = await confirmLoginIdRecovery(otp.id, code.trim());
    setSubmitting(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setRevealedLoginId(res.loginId);
  }

  if (revealedLoginId) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="size-6" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Your Login ID</h3>
          <p className="mt-2 rounded-md bg-accent px-3 py-2 font-mono text-base font-semibold text-accent-foreground">{revealedLoginId}</p>
          <p className="mt-2 text-sm text-muted-foreground">Use this to sign in. Your password is unchanged.</p>
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
          <Label htmlFor="loginid-otp-code">Super Admin OTP</Label>
          <Input
            id="loginid-otp-code"
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
          Verify & show my Login ID
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
          <Label htmlFor="name">Your Full Name (as registered)</Label>
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="name" type="text" autoComplete="name" placeholder="e.g. Shoaib Shaikh" className="pl-8" {...register("name")} />
          </div>
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <p className="text-xs text-muted-foreground">
          <ShieldCheck className="mr-1 inline size-3" />
          The Super Admin approves this with a one-time code before your login ID is shown.
        </p>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          Send request
        </Button>
      </form>

      <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </div>
  );
}
