"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { AttachmentInput } from "@/components/shared/attachment-input";
import { paymentSchema, type PaymentFormValues } from "@/lib/validation";
import { updatePayment } from "@/server/actions/payments";

type EditablePayment = {
  id: string;
  clientName: string;
  clientMobile: string | null;
  amount: number;
  dueDate: Date;
  mybillbookInvoiceNo: string | null;
  invoiceAttachmentUrl: string | null;
  notes: string | null;
};

export function EditPaymentDialog({ payment }: { payment: EditablePayment }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState(payment.invoiceAttachmentUrl ?? "");
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      clientName: payment.clientName,
      clientMobile: payment.clientMobile ?? "",
      amount: payment.amount,
      dueDate: new Date(payment.dueDate).toISOString().slice(0, 10),
      mybillbookInvoiceNo: payment.mybillbookInvoiceNo ?? "",
      notes: payment.notes ?? "",
    },
  });

  async function onSubmit(values: PaymentFormValues) {
    setSubmitting(true);
    const res = await updatePayment(payment.id, { ...values, invoiceAttachmentUrl: attachmentUrl });
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Invoice updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Edit invoice">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
          <DialogDescription>Update the payment details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>Client Name</Label>
            <Input {...register("clientName")} />
            {errors.clientName && <p className="text-xs text-destructive">{errors.clientName.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Client Mobile</Label>
              <Input {...register("clientMobile")} />
            </div>
            <div className="space-y-1">
              <Label>Amount (₹)</Label>
              <Input type="number" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Input type="date" {...register("dueDate")} />
              {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>MyBillBook Invoice #</Label>
              <Input {...register("mybillbookInvoiceNo")} placeholder="Optional" />
            </div>
          </div>
          <AttachmentInput value={attachmentUrl} onChange={setAttachmentUrl} folder="invoices" label="MyBillBook / Invoice Attachment" />
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} {...register("notes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
