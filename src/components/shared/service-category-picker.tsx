"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SERVICE_CATEGORY_LABELS, SERVICE_CATALOG } from "@/lib/constants";

/** Dynamic Category → Subcategory picker for the Smart Booking Form. */
export function ServiceCategoryPicker({
  category,
  variant,
  onCategoryChange,
  onVariantChange,
}: {
  category: string;
  variant: string;
  onCategoryChange: (v: string) => void;
  onVariantChange: (v: string) => void;
}) {
  const options = SERVICE_CATALOG[category] ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Service Category</Label>
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SERVICE_CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{category === "PAINTING" || category === "PEST_CONTROL" ? "Type" : "Details"}</Label>
        <Select value={variant} onValueChange={onVariantChange} disabled={options.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder={options.length ? "Select an option" : "Pick a category first"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
