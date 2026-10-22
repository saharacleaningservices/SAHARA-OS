"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resendInvoiceLink } from "@/server/actions/job-billing";

/** Sends the customer's View Invoice (+ Pay Balance) WhatsApp again — for when the first message did not arrive. */
export function ResendInvoiceLinkButton({ jobId, variant = "outline" }: { jobId: string; variant?: "outline" | "default" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await resendInvoiceLink(jobId);
          if (!res.success) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Resend Invoice Link
    </Button>
  );
}
