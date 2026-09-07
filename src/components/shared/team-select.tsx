"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Internal crew team picker (Team 1–4, or Unassigned). Used on the CRM lead
 * form, the Confirm Booking dialog and both job forms so the selected team
 * carries from the enquiry through to the scheduled job.
 */
export function TeamSelect({
  value,
  onChange,
  label = "Team",
  hideLabel = false,
}: {
  value: number | "" | null | undefined;
  onChange: (value: number | "") => void;
  label?: string;
  hideLabel?: boolean;
}) {
  const current = value ? String(value) : "NONE";
  return (
    <div className="space-y-1.5">
      {!hideLabel && <Label>{label}</Label>}
      <Select value={current} onValueChange={(v) => onChange(v === "NONE" ? "" : Number(v))}>
        <SelectTrigger>
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NONE">Unassigned</SelectItem>
          {[1, 2, 3, 4].map((n) => (
            <SelectItem key={n} value={String(n)}>
              Team {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
