import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Compact "22 Sep" — no year — for dense table cells (Jobs/Leads Schedule
 * column) where the year is implied and every character of row height/width
 * counts. Use formatDate() instead wherever the year matters (invoices,
 * detail pages, anything printed). */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function toWhatsAppLink(mobile: string, message?: string): string {
  const digits = mobile.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  const base = `https://wa.me/${withCountry}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function toTelLink(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  return `tel:${digits}`;
}

/**
 * The customer-facing Area field was removed from the booking / lead / job
 * forms in favour of a full Address + PIN Code. The `area` column stays
 * NOT NULL for existing reports, dashboards and job cards, so derive a value
 * from PIN → first address line → placeholder.
 */
export function deriveArea(input: {
  area?: string | null;
  pinCode?: string | null;
  address?: string | null;
}): string {
  return (
    (input.area && input.area.trim()) ||
    (input.pinCode && input.pinCode.trim()) ||
    (input.address ? input.address.split(/[\n,]/)[0]!.trim().slice(0, 60) : "") ||
    "—"
  );
}

/**
 * Relative-day classification for a date, used for the "TODAY / Tomorrow /
 * Overdue" badges across the Leads CRM and Jobs list.
 */
export type DayBucket = "OVERDUE" | "TODAY" | "TOMORROW" | "FUTURE" | "NONE";

export function dayBucket(date: Date | string | null | undefined): DayBucket {
  if (!date) return "NONE";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "NONE";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - start.getTime()) / 86400000);
  if (diffDays < 0) return "OVERDUE";
  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "TOMORROW";
  return "FUTURE";
}

export const DAY_BUCKET_META: Record<
  Exclude<DayBucket, "NONE" | "FUTURE">,
  { label: string; badge: "destructive" | "success" | "info"; dot: string }
> = {
  OVERDUE: { label: "Overdue", badge: "destructive", dot: "bg-destructive" },
  TODAY: { label: "TODAY", badge: "success", dot: "bg-success" },
  TOMORROW: { label: "Tomorrow", badge: "info", dot: "bg-primary" },
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
