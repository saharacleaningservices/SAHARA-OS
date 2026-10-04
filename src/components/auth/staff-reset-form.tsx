"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { requestStaffPinReset } from "@/server/actions/staff-pin-reset";

export function StaffResetForm() {
  const [mobile, setMobile] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await requestStaffPinReset({ mobile, newPin, confirmPin });
    setBusy(false);
    if ("error" in res && res.error) return setError(res.error);
    setDone("message" in res ? res.message : "Request sent.");
  }

  if (done) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <p className="text-sm">{done}</p>
        <p className="text-xs text-muted-foreground">The office may call you to confirm. Once approved, sign in with your new PIN.</p>
        <Button asChild className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sr-mobile">Your mobile number</Label>
        <Input id="sr-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" placeholder="10-digit mobile" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-pin">New PIN (4–6 digits)</Label>
        <PasswordInput id="sr-pin" value={newPin} onChange={(e) => setNewPin(e.target.value)} autoComplete="new-password" inputMode="numeric" placeholder="e.g. 4 digits" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-pin2">New PIN again</Label>
        <PasswordInput id="sr-pin2" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} autoComplete="new-password" inputMode="numeric" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} Send reset request
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Your new PIN starts working after the office approves the request.{" "}
        <Link href="/login" className="text-primary">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
