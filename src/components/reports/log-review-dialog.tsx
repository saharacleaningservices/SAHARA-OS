"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { reviewSchema, type ReviewFormValues } from "@/lib/validation";
import { createReview } from "@/server/actions/reviews";

export function LogReviewDialog() {
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
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 5 },
  });

  const rating = watch("rating");

  async function onSubmit(values: ReviewFormValues) {
    setSubmitting(true);
    const res = await createReview(values);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Review logged");
    setOpen(false);
    reset({ rating: 5 });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Log a Review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log a Google Review</DialogTitle>
          <DialogDescription>Record a review you've seen land on Google — there's no auto-sync yet.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>Rating</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setValue("rating", n)}
                  className="p-0.5"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star className={`size-6 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Customer Mobile</Label>
            <Input {...register("customerMobile")} placeholder="98765 43210" />
            {errors.customerMobile && <p className="text-xs text-destructive">{errors.customerMobile.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Customer Name (optional)</Label>
            <Input {...register("customerName")} />
          </div>
          <div className="space-y-1">
            <Label>Review Text (optional)</Label>
            <Input {...register("comment")} placeholder="What did they say?" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Save Review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
