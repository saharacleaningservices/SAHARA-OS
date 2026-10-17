"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Lock, Smartphone, ShieldCheck, XCircle, Eye, EyeOff, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { biometricSupported, markActiveNow, passkeyOnThisDevice, signInWithBiometric } from "@/lib/webauthn-client";

const schema = z.object({
  loginId: z.string().trim().min(3, "Enter your mobile number"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const POLL_INTERVAL_MS = 4000;

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [denied, setDenied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Biometric sign-in (Face ID / fingerprint / device PIN) — shown only where the device supports it.
  const [bioReady, setBioReady] = useState(false);
  const [bioHere, setBioHere] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  useEffect(() => {
    void biometricSupported().then((ok) => {
      setBioReady(ok);
      setBioHere(ok && passkeyOnThisDevice());
    });
  }, []);

  async function onBiometric() {
    setError(null);
    setDenied(false);
    setBioLoading(true);
    const r = await signInWithBiometric();
    setBioLoading(false);
    if (r.ok) return goToDestination();
    if (!r.cancelled) setError(r.error);
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { loginId: "", password: "" },
  });

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function goToDestination() {
    markActiveNow();
    router.push(next && next.startsWith("/") ? next : "/dashboard");
    router.refresh();
  }

  function startPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/device-status");
        const data = await res.json();
        if (data.approved) {
          if (pollRef.current) clearInterval(pollRef.current);
          goToDestination();
        } else if (data.denied) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPendingApproval(false);
          setDenied(true);
        } else if (data.expired || res.status === 401) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPendingApproval(false);
          setError(data.expired ? "The approval request expired. Please sign in again." : "Device approved — please sign in again.");
        }
      } catch {
        // transient network issue — keep polling
      }
    }, POLL_INTERVAL_MS);
  }

  async function onSubmit(values: FormValues) {
    setError(null);
    setDenied(false);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (data.pending) {
        setPendingApproval(true);
        startPolling();
        return;
      }
      goToDestination();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  if (pendingApproval) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="size-6" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Waiting for approval</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This is a new device. Altaf has been notified and needs to approve this sign-in before you can continue.
          </p>
        </div>
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">This page updates automatically once approved.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      {bioReady && (
        <div className="space-y-3">
          <Button type="button" variant={bioHere ? "default" : "outline"} className="h-11 w-full" onClick={onBiometric} disabled={bioLoading || loading}>
            {bioLoading ? <Loader2 className="animate-spin" /> : <Fingerprint className="size-5" />}
            Sign in with Face ID / Fingerprint
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            {bioHere ? "Uses this phone's own Face ID, fingerprint or screen lock." : "Enable it once from My Profile after signing in with your password."}
          </p>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or use password <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="loginId">Mobile Number</Label>
          <div className="relative">
            <Smartphone className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="loginId"
              type="text"
              inputMode="tel"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="10-digit mobile number"
              className="pl-8"
              {...register("loginId")}
            />
          </div>
          {errors.loginId && <p className="text-xs text-destructive">{errors.loginId.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Password or PIN"
              className="pl-8 pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-between">
          <Link href="/forgot-login-id" className="text-xs font-medium text-primary hover:underline">
            Forgot Login ID?
          </Link>
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Field staff forgot PIN?{" "}
          <Link href="/staff-reset" className="font-medium text-primary hover:underline">
            Request a reset
          </Link>
          {" · "}
          New staff?{" "}
          <Link href="/staff-register" className="font-medium text-primary hover:underline">
            Register
          </Link>
        </p>

        {denied && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <XCircle className="size-4 shrink-0" />
            This device was not approved. Contact Altaf if this was you.
          </div>
        )}
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>
    </div>
  );
}
