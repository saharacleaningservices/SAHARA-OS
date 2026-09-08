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

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
