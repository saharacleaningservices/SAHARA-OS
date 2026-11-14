"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Truck, PlayCircle, CheckCircle2, ClipboardCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateJobStatus, completeJobWithCertificate } from "@/server/actions/jobs";
import { requestJobOtp, verifyJobOtp } from "@/server/actions/job-otp";
import { getPosition } from "@/lib/client-geo";
import { LocationPinger } from "@/components/staff/location-pinger";
import { JOB_STATUS_LABELS } from "@/lib/constants";

const NEXT_STATUS: Record<string, { next: "ON_THE_WAY" | "STARTED" | "COMPLETED"; label: string; icon: typeof Truck }> = {
  ASSIGNED: { next: "ON_THE_WAY", label: "Mark On the Way", icon: Truck },
  ON_THE_WAY: { next: "STARTED", label: "Mark Started", icon: PlayCircle },
  STARTED: { next: "COMPLETED", label: "Mark Completed", icon: CheckCircle2 },
};

export type JobOtpState = { enforced: boolean; startVerified: boolean; completeVerified: boolean };

function OtpPanel({ jobId, purpose, verified, enforced }: { jobId: string; purpose: "START" | "COMPLETE"; verified: boolean; enforced: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const label = purpose === "START" ? "start" : "completion";

  if (verified) {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-success">
        <KeyRound className="size-3.5" /> Customer {label} OTP verified
      </p>
    );
  }

  function send() {
    startTransition(async () => {
      const res = await requestJobOtp(jobId, purpose);
      if ("error" in res && res.error) return void toast.error(res.error);
      setSent(true);
      toast.success(
        "fallbackLogged" in res && res.fallbackLogged
          ? "OTP created — WhatsApp not delivered; see Admin → WhatsApp Log"
          : "OTP sent to customer on WhatsApp"
      );
    });
  }

  function verify() {
    startTransition(async () => {
      const res = await verifyJobOtp(jobId, purpose, code);
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success("OTP verified");
      setCode("");
      router.refresh();
    });
  }

  return (
    <div className="w-full space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">
        Customer {label} OTP {enforced ? "(required)" : "(optional)"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={send} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <KeyRound className="size-3.5" />}
          {sent ? "Resend OTP" : "Send OTP to customer"}
        </Button>
        {sent && (
          <>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="h-8 w-32"
            />
            <Button size="sm" onClick={verify} disabled={pending || code.length !== 6}>
              Verify
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function StatusActions({ jobId, status, otp }: { jobId: string; status: string; otp?: JobOtpState }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const step = NEXT_STATUS[status];

  // Which OTP (if any) guards the next transition.
  const otpPurpose: "START" | "COMPLETE" | null = step?.next === "STARTED" ? "START" : step?.next === "COMPLETED" ? "COMPLETE" : null;
  const otpVerified = otpPurpose === "START" ? otp?.startVerified : otp?.completeVerified;
  const blocked = Boolean(otp?.enforced && otpPurpose && !otpVerified);

  function advance() {
    if (!step) return;
    startTransition(async () => {
      // Capture the staff member's GPS fix at the moment of start/complete.
      const fix = step.next === "STARTED" || step.next === "COMPLETED" ? await getPosition() : null;
      const res = await updateJobStatus(jobId, step.next, fix ? { lat: fix.lat, lng: fix.lng } : null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Status updated: ${JOB_STATUS_LABELS[step.next]}`);
      router.refresh();
    });
  }

  function completeWithCertificate() {
    startTransition(async () => {
      const fix = await getPosition();
      const res = await completeJobWithCertificate(jobId, fix ? { lat: fix.lat, lng: fix.lng } : null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Job completed — certificate & invoice generated");
      router.refresh();
    });
  }

  if (status === "COMPLETED") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-success">
        <CheckCircle2 className="size-4" /> Job Completed
      </span>
    );
  }

  const Icon = step?.icon ?? ClipboardCheck;
  const completeBlocked = Boolean(otp?.enforced && !otp.completeVerified);

  return (
    <div className="flex flex-wrap gap-2">
      <LocationPinger active={status === "ON_THE_WAY" || status === "STARTED"} jobId={jobId} />
      {otp && otpPurpose && <OtpPanel jobId={jobId} purpose={otpPurpose} verified={Boolean(otpVerified)} enforced={otp.enforced} />}
      {step && (
        <Button size="sm" onClick={advance} disabled={pending || blocked}>
          {pending ? <Loader2 className="animate-spin" /> : <Icon className="size-3.5" />}
          {step.label}
        </Button>
      )}
      {status === "STARTED" && (
        <Button size="sm" variant="success" onClick={completeWithCertificate} disabled={pending || completeBlocked}>
          {pending ? <Loader2 className="animate-spin" /> : <ClipboardCheck className="size-3.5" />}
          Complete &amp; Generate Certificate
        </Button>
      )}
    </div>
  );
}
