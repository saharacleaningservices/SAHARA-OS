"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CompanyPaymentDetails = {
  upiId: string | null;
  upiQrUrl: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium text-foreground">{value}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked */
          }
        }}
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

/** Shows the payment instructions for the chosen mode. */
export function PaymentDetailsBox({ mode, details, large }: { mode: string; details: CompanyPaymentDetails; /** Prominent QR (confirmation screen). */ large?: boolean }) {
  if (mode === "CASH") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Pay at service — our team will collect on the day of the job.
      </div>
    );
  }

  if (mode === "QR") {
    return details.upiQrUrl ? (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3">
        <img src={details.upiQrUrl} alt="Scan to pay the advance" className={`${large ? "size-64 sm:size-72" : "size-44"} rounded-lg border border-border bg-white object-contain`} />
        <p className="text-xs text-muted-foreground">Scan with any UPI app</p>
        {details.upiId && <p className="text-xs font-medium text-foreground">{details.upiId}</p>}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">QR not set up yet — our team will share it.</p>
    );
  }

  if (mode === "UPI") {
    return details.upiId ? (
      <CopyRow label="UPI ID" value={details.upiId} />
    ) : (
      <p className="text-sm text-muted-foreground">UPI ID not set up yet — our team will share it.</p>
    );
  }

  if (mode === "BANK") {
    if (!details.bankAccountNumber) {
      return <p className="text-sm text-muted-foreground">Bank details not set up yet — our team will share them.</p>;
    }
    return (
      <div className="space-y-2">
        <CopyRow label="Account Name" value={details.bankAccountName ?? ""} />
        <CopyRow label="Account Number" value={details.bankAccountNumber} />
        {details.bankIfsc && <CopyRow label="IFSC" value={details.bankIfsc} />}
        {details.bankName && <CopyRow label="Bank" value={details.bankName} />}
      </div>
    );
  }

  return null;
}
