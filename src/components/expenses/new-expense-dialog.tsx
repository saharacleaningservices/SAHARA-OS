"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { expenseSchema, type ExpenseFormValues } from "@/lib/validation";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/constants";
import { createExpense } from "@/server/actions/expenses";

type JobOption = { id: string; jobNumber: string; customerName: string };

export function NewExpenseDialog({ jobOptions = [] }: { jobOptions?: JobOption[] }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { category: "MISCELLANEOUS", date: new Date().toISOString().slice(0, 10) },
  });

  async function onSubmit(values: ExpenseFormValues) {
    setSubmitting(true);
    const res = await createExpense(values);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Expense recorded");
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record an Expense</DialogTitle>
          <DialogDescription>Track housekeeping material, fuel, cab fare, equipment, vendor payments and more.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={watch("category")} onValueChange={(v) => setValue("category", v as ExpenseFormValues["category"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORY_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input {...register("description")} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Amount (₹)</Label>
              <Input type="number" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" {...register("date")} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Paid To</Label>
            <Input {...register("paidTo")} placeholder="Vendor / staff name" />
          </div>
          {jobOptions.length > 0 && (
            <div className="space-y-1">
              <Label>Link to Job (optional)</Label>
              <Select
                value={watch("jobId") || "none"}
                onValueChange={(v) => setValue("jobId", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not linked to a job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked to a job</SelectItem>
                  {jobOptions.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.jobNumber} · {j.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Shows this expense on the job&apos;s page so cost-per-job stays accurate.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Save Expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
