"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markPaymentPaid } from "@/server/actions/payments";

export function MarkPaidButton({ paymentId }: { paymentId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function markPaid() {
    startTransition(async () => {
      const res = await markPaymentPaid(paymentId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Marked as paid");
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="success" onClick={markPaid} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="size-3.5" />}
      Mark Paid
    </Button>
  );
}
