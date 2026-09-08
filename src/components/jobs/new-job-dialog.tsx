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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jobSchema, type JobFormValues } from "@/lib/validation";
import { SERVICE_OPTIONS } from "@/lib/constants";
import { createJob } from "@/server/actions/jobs";
import { TeamSelect } from "@/components/shared/team-select";

type StaffOption = { id: string; name: string; designation: string };

export function NewJobDialog({ staffOptions }: { staffOptions: StaffOption[] }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      service: "HOME_DEEP_CLEANING",
      jobValue: 3999,
      scheduledTime: "10:00",
      teamNumber: "",
    },
  });

  const supervisors = staffOptions.filter((s) => s.designation === "Supervisor");

  async function onSubmit(values: JobFormValues) {
    setSubmitting(true);
    const res = await createJob({ ...values, staffIds: selectedStaff });
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Job created");
    setOpen(false);
    reset();
    setSelectedStaff([]);
    router.push(`/jobs/${res.jobId}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New Job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule a New Job</DialogTitle>
          <DialogDescription>Minimum job value is ₹3,999.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Customer Name</Label>
              <Input {...register("customerName")} />
              {errors.customerName && <p className="text-xs text-destructive">{errors.customerName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Mobile</Label>
              <Input {...register("customerMobile")} />
              {errors.customerMobile && <p className="text-xs text-destructive">{errors.customerMobile.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>PIN Code</Label>
              <Input {...register("pinCode")} inputMode="numeric" maxLength={6} placeholder="411028" />
              {errors.pinCode && <p className="text-xs text-destructive">{errors.pinCode.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Service</Label>
              <Select value={watch("service")} onValueChange={(v) => setValue("service", v as JobFormValues["service"])}>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Flat / Type</Label>
              <Input {...register("serviceVariant")} placeholder="2 BHK / Sofa …" />
            </div>
            <div className="space-y-1">
              <Label>Package (optional)</Label>
              <Input {...register("packageName")} placeholder="Premium / Platinum …" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Textarea rows={2} {...register("address")} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" {...register("scheduledDate")} />
            </div>
            <div className="space-y-1">
              <Label>Time</Label>
              <Input type="time" {...register("scheduledTime")} />
            </div>
            <div className="space-y-1">
              <Label>Job Value (₹)</Label>
              <Input type="number" {...register("jobValue")} />
              {errors.jobValue && <p className="text-xs text-destructive">{errors.jobValue.message}</p>}
            </div>
          </div>

          <TeamSelect value={watch("teamNumber")} onChange={(v) => setValue("teamNumber", v)} />

          <div className="space-y-1">
            <Label>Supervisor</Label>
            <Select value={watch("supervisorId") || "NONE"} onValueChange={(v) => setValue("supervisorId", v === "NONE" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select supervisor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Unassigned</SelectItem>
                {supervisors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Assign Crew</Label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {staffOptions
                .filter((s) => s.designation !== "Supervisor")
                .map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
                    <Checkbox
                      checked={selectedStaff.includes(s.id)}
                      onCheckedChange={(checked) =>
                        setSelectedStaff((prev) => (checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                      }
                    />
                    {s.name} <span className="text-xs text-muted-foreground">({s.designation})</span>
                  </label>
                ))}
            </div>
          </div>

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
              Create Job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
