"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
}: {
  jobId: string;
  staffOptions: StaffOption[];
  defaultValues: JobFormValues;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<JobFormValues>({ resolver: zodResolver(jobSchema), defaultValues });

  const supervisors = staffOptions.filter((s) => s.designation === "Supervisor");

  async function onSubmit(values: JobFormValues) {
    setSubmitting(true);
    const res = await updateJob(jobId, values);
    setSubmitting(false);
    if (res.error) {
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
          <div className="space-y-1.5">
            <Label htmlFor="customerMobile">Mobile</Label>
            <Input id="customerMobile" {...register("customerMobile")} />
            {errors.customerMobile && <p className="text-xs text-destructive">{errors.customerMobile.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area">Area</Label>
            <Input id="area" {...register("area")} />
            {errors.area && <p className="text-xs text-destructive">{errors.area.message}</p>}
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
          <div className="space-y-1.5">
            <Label htmlFor="jobValue">Job Value (₹)</Label>
            <Input id="jobValue" type="number" {...register("jobValue")} />
            {errors.jobValue && <p className="text-xs text-destructive">{errors.jobValue.message}</p>}
          </div>
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
