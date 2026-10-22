"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SendPaymentLinkButton } from "@/components/shared/send-payment-link-button";
import type { CompanyPaymentDetails } from "@/components/shared/payment-details-box";

/** Free-standing form around the shared SendPaymentLinkButton (no job/lead needed). Opens WhatsApp only — records nothing. */
export function PaymentLinkSender({ details }: { details: CompanyPaymentDetails }) {
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [purpose, setPurpose] = useState<"ADVANCE" | "BALANCE">("BALANCE");
  const digits = mobile.replace(/\D/g, "").slice(-10);
  const amt = Math.round(Number(amount));
  const ready = /^[6-9]\d{9}$/.test(digits) && Number.isFinite(amt) && amt > 0;
  const field = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-3 pt-6 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pl-mobile">Customer mobile</Label>
          <Input id="pl-mobile" type="tel" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="10-digit mobile" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pl-name">Customer name</Label>
          <Input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pl-amount">Amount (₹)</Label>
          <Input id="pl-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1200" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pl-purpose">For</Label>
          <select id="pl-purpose" className={field} value={purpose} onChange={(e) => setPurpose(e.target.value as "ADVANCE" | "BALANCE")}>
            <option value="BALANCE">Balance payment</option>
            <option value="ADVANCE">Advance payment</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="pl-booking">Booking / job ID</Label>
          <Input id="pl-booking" value={bookingId} onChange={(e) => setBookingId(e.target.value)} placeholder="Optional, e.g. JOB-2026-0123" />
        </div>
        <div className="sm:col-span-2">
          {ready ? (
            <SendPaymentLinkButton
              mobile={digits}
              details={details}
              purpose={purpose}
              size="default"
              variant="default"
              label="Open WhatsApp with payment request"
              context={{ customerName: name || null, bookingId: bookingId || null, advance: purpose === "ADVANCE" ? amt : null, balance: amt }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Enter a valid 10-digit mobile and an amount to continue.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
