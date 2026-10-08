"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jobSchema, type JobFormValues } from "@/lib/validation";
import { SERVICE_OPTIONS } from "@/lib/constants";
import { updateJob } from "@/server/actions/jobs";
import { TeamSelect } from "@/components/shared/team-select";

type StaffOption = { id: string; name: string; designation: string };

export function JobEditForm({
  jobId,
  staffOptions,
  defaultValues,
  defaultStaffIds = [],
  restricted = false,
}: {
  jobId: string;
  staffOptions: StaffOption[];
  defaultValues: JobFormValues;
  defaultStaffIds?: string[];
  /** Operations: no customer mobile / job value fields (never sent, never saved). */
  restricted?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string[]>(defaultStaffIds);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<JobFormValues>({
    resolver: zodResolver(restricted ? jobSchema.extend({ customerMobile: z.string().optional().or(z.literal("")), jobValue: z.coerce.number().optional() }) : jobSchema) as never,
    defaultValues,
  });

  const supervisors = staffOptions.filter((s) => s.designation === "Supervisor");

  async function onSubmit(values: JobFormValues) {
    setSubmitting(true);
    const { customerMobile, jobValue, ...rest } = values;
    const res = await updateJob(jobId, restricted ? { ...rest, staffIds: selectedStaff } : { ...rest, customerMobile, jobValue, staffIds: selectedStaff });
    setSubmitting(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Job updated");
    router.push(`/jobs/${jobId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="customerName">Customer Name</Label>
            <Input id="customerName" {...register("customerName")} />
            {errors.customerName && <p className="text-xs text-destructive">{errors.customerName.message}</p>}
          </div>
          {!restricted && (
            <div className="space-y-1.5">
              <Label htmlFor="customerMobile">Mobile</Label>
              <Input id="customerMobile" {...register("customerMobile")} />
              {errors.customerMobile && <p className="text-xs text-destructive">{errors.customerMobile.message}</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pinCode">PIN Code</Label>
            <Input id="pinCode" {...register("pinCode")} inputMode="numeric" maxLength={6} placeholder="411028" />
            {errors.pinCode && <p className="text-xs text-destructive">{errors.pinCode.message}</p>}
          </div>
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <Label htmlFor="serviceVariant">Flat / Type</Label>
            <Input id="serviceVariant" {...register("serviceVariant")} placeholder="2 BHK / Sofa …" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="packageName">Package (optional)</Label>
            <Input id="packageName" {...register("packageName")} placeholder="Premium / Platinum …" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" rows={2} {...register("address")} />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scheduledDate">Date</Label>
            <Input id="scheduledDate" type="date" {...register("scheduledDate")} />
            {errors.scheduledDate && <p className="text-xs text-destructive">{errors.scheduledDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scheduledTime">Time</Label>
            <Input id="scheduledTime" type="time" {...register("scheduledTime")} />
            {errors.scheduledTime && <p className="text-xs text-destructive">{errors.scheduledTime.message}</p>}
          </div>
          {!restricted && (
            <div className="space-y-1.5">
              <Label htmlFor="jobValue">Job Value (₹)</Label>
              <Input id="jobValue" type="number" {...register("jobValue")} />
              {errors.jobValue && <p className="text-xs text-destructive">{errors.jobValue.message}</p>}
            </div>
          )}
          <TeamSelect value={watch("teamNumber")} onChange={(v) => setValue("teamNumber", v)} />
          <div className="space-y-1.5">
            <Label>Supervisor</Label>
            <Select
              value={watch("supervisorId") || "NONE"}
              onValueChange={(v) => setValue("supervisorId", v === "NONE" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Assign Crew</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
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
            {selectedStaff.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Crew: {selectedStaff.map((id) => staffOptions.find((s) => s.id === id)?.name).filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="scopeOfWork">Scope of work (shown in the Staff App)</Label>
            <Textarea id="scopeOfWork" rows={3} {...register("scopeOfWork")} placeholder="Exact package / rooms / items agreed with the customer" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
