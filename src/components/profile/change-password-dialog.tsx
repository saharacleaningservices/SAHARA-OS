"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { changePasswordSchema, staffChangePinSchema, type ChangePasswordFormValues } from "@/lib/validation";
import { changePassword, confirmPasswordChange } from "@/server/actions/settings";

/** selfService: Staff App — the change applies immediately (no Super Admin code). */
export function ChangePasswordDialog({ selfService = false }: { selfService?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otp, setOtp] = useState<{ id: string; ttl: number } | null>(null);
  const [code, setCode] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(selfService ? staffChangePinSchema : changePasswordSchema) });

  function resetAll() {
    reset();
    setOtp(null);
    setCode("");
  }

  async function onSubmit(values: ChangePasswordFormValues) {
    setSubmitting(true);
    const res = await changePassword(values);
    setSubmitting(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    if ("otpRequired" in res && res.otpRequired) {
      setOtp({ id: res.otpId, ttl: res.ttlMinutes });
      toast.message("Approval required", {
        description: `An OTP was sent to the Super Admin. Enter the code they share (valid ${res.ttlMinutes} min).`,
      });
      return;
    }
    toast.success(selfService ? "PIN changed" : "Password changed");
    setOpen(false);
    resetAll();
  }

  async function submitOtp() {
    if (!otp) return;
    if (code.trim().length < 4) {
      toast.error("Enter the code from the Super Admin");
      return;
    }
    setSubmitting(true);
    const res = await confirmPasswordChange(otp.id, code.trim());
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(selfService ? "PIN changed" : "Password changed");
    setOpen(false);
    resetAll();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetAll();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound className="size-4" /> {selfService ? "Change my PIN" : "Change Password"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{selfService ? "Change my PIN" : "Change Password"}</DialogTitle>
          <DialogDescription>
            {otp
              ? "The Super Admin (Altaf) received a one-time code. Enter it here to finish."
              : selfService
                ? "Choose a 4–6 digit PIN that only you know. It works immediately."
                : "At least 6 characters. Every change is approved by the Super Admin with a one-time code."}
          </DialogDescription>
        </DialogHeader>

        {otp ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="otp-code">Super Admin OTP</Label>
              <Input
                id="otp-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetAll}>
                Start over
              </Button>
              <Button type="button" onClick={submitOtp} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : <ShieldCheck className="size-4" />}
                Confirm
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="currentPassword">{selfService ? "Current PIN" : "Current Password"}</Label>
              <PasswordInput id="currentPassword" autoComplete="current-password" inputMode={selfService ? "numeric" : undefined} {...register("currentPassword")} />
              {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="newPassword">{selfService ? "New PIN (4–6 digits)" : "New Password"}</Label>
              <PasswordInput id="newPassword" autoComplete="new-password" inputMode={selfService ? "numeric" : undefined} {...register("newPassword")} />
              {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">{selfService ? "New PIN again" : "Confirm New Password"}</Label>
              <PasswordInput id="confirmPassword" autoComplete="new-password" inputMode={selfService ? "numeric" : undefined} {...register("confirmPassword")} />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                Update Password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
