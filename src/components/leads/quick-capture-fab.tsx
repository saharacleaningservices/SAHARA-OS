"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { quickCaptureSchema, type QuickCaptureFormValues } from "@/lib/validation";
import { SERVICE_OPTIONS } from "@/lib/constants";
import { quickCaptureLead } from "@/server/actions/leads";

export function QuickCaptureFab() {
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
  } = useForm<QuickCaptureFormValues>({
    resolver: zodResolver(quickCaptureSchema),
    defaultValues: { service: "HOME_DEEP_CLEANING" },
  });

  // Ctrl/⌘ + N opens Quick Capture from anywhere in the app.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "n" || e.key === "N") && !e.shiftKey) {
        const t = e.target as HTMLElement | null;
        if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onSubmit(values: QuickCaptureFormValues) {
    setSubmitting(true);
    const res = await quickCaptureLead(values);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Enquiry captured");
    setOpen(false);
    reset({ service: "HOME_DEEP_CLEANING" });
    if (res.leadId) router.push(`/leads/${res.leadId}`);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 z-40 h-14 gap-2 rounded-full px-5 shadow-lg sm:right-6 lg:right-8"
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
        aria-label="Quick capture a lead (Ctrl+N)"
        title="Quick Capture (Ctrl+N)"
      >
        <Zap className="size-5" />
        <span className="hidden sm:inline">Quick Capture</span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset({ service: "HOME_DEEP_CLEANING" });
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quick Capture</DialogTitle>
            <DialogDescription>Save a lead in 30 seconds — fill in the rest later.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="qc-mobile">Mobile</Label>
              <Input id="qc-mobile" inputMode="tel" autoFocus {...register("mobile")} placeholder="9876543210" />
              {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="qc-name">Name</Label>
              <Input id="qc-name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="qc-area">Area</Label>
              <Input id="qc-area" {...register("area")} placeholder="e.g. Magarpatta City" />
              {errors.area && <p className="text-xs text-destructive">{errors.area.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Service</Label>
              <Select
                value={watch("service")}
                onValueChange={(v) => setValue("service", v as QuickCaptureFormValues["service"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                Capture
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
