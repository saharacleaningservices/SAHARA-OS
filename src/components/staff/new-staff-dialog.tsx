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
import { staffSchema, type StaffFormValues } from "@/lib/validation";
import { createStaff, updateStaff } from "@/server/actions/staff";

const DESIGNATIONS = ["Cleaning Executive", "Supervisor", "Painter", "Pest Control Technician", "Housekeeping Executive"];

export function NewStaffDialog({
  staffId,
  defaultValues,
  trigger,
}: {
  staffId?: string;
  defaultValues?: Partial<StaffFormValues>;
  trigger?: React.ReactNode;
}) {
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
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { salaryType: "DAILY", designation: "Cleaning Executive", ...defaultValues },
  });

  async function onSubmit(values: StaffFormValues) {
    setSubmitting(true);
    const res = staffId ? await updateStaff(staffId, values) : await createStaff(values);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(staffId ? "Staff updated" : "Staff added");
    setOpen(false);
    if (!staffId) reset();
    router.refresh();
  }

  const salaryType = watch("salaryType");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" /> Add Staff
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{staffId ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
          <DialogDescription>
            {staffId ? "Update this team member's details." : "Add a new team member to Sahara Cleaning Services."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Mobile</Label>
            <Input {...register("mobile")} />
            {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Designation</Label>
            <Select value={watch("designation")} onValueChange={(v) => setValue("designation", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DESIGNATIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Salary Type</Label>
              <Select value={salaryType} onValueChange={(v) => setValue("salaryType", v as "DAILY" | "MONTHLY")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily Wage</SelectItem>
                  <SelectItem value="MONTHLY">Monthly Salary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{salaryType === "MONTHLY" ? "Monthly Salary (₹)" : "Daily Wage (₹)"}</Label>
              <Input type="number" {...register(salaryType === "MONTHLY" ? "monthlySalary" : "dailyWage")} />
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
              {staffId ? "Save changes" : "Add Staff"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
