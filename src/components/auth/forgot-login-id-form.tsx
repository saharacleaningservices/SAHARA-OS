"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotLoginIdSchema, type ForgotLoginIdFormValues } from "@/lib/validation";
import { requestLoginIdRecovery } from "@/server/actions/login-id-recovery";

export function ForgotLoginIdForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotLoginIdFormValues>({ resolver: zodResolver(forgotLoginIdSchema) });

  async function onSubmit(values: ForgotLoginIdFormValues) {
    setSubmitting(true);
    const res = await requestLoginIdRecovery(values);
    setSubmitting(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="size-6" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Request sent</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            If that name matches an account, the Super Admin has been notified and will contact you with your registered mobile number / email.
          </p>
        </div>
        <Link href="/login" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
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
          The Super Admin (Altaf) will verify it's really you and call you with your registered mobile number / email — it's never shown here.
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
