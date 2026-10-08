"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateFinalInvoice } from "@/server/actions/jobs";

/** For jobs completed before auto-invoicing: create the Final Invoice from the job's data. */
export function GenerateInvoiceButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await generateFinalInvoice(jobId);
          if ("error" in res && res.error) return void toast.error(res.error);
          toast.success(`Final invoice ${"invoiceNumber" in res ? res.invoiceNumber : ""} generated`);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Receipt className="size-3.5" />} Generate Final Invoice
    </Button>
  );
}
