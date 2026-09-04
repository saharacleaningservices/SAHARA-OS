"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Lock, Mail, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function goToDestination() {
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
        } else if (data.expired) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPendingApproval(false);
          setError("The approval request expired. Please sign in again.");
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" placeholder="you@saharacleaningservices.com" className="pl-8" {...register("email")} />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type="password" placeholder="••••••••" className="pl-8" {...register("password")} />
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

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
