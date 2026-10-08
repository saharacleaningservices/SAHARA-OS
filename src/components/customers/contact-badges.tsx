import { Briefcase, Building, Building2, DraftingCompass, Palette, Star, User, type LucideIcon } from "lucide-react";

// Contact type + repeat badges — one compact visual language for the
// customer list, customer page and New Lead lookup.

const TYPES: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  CUSTOMER: { label: "Customer", icon: User, tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  BROKER: { label: "Broker", icon: Building2, tone: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" },
  ARCHITECT: { label: "Architect", icon: DraftingCompass, tone: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200" },
  INTERIOR_DESIGNER: { label: "Interior Designer", icon: Palette, tone: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200" },
  SOCIETY: { label: "Society / Facility", icon: Building, tone: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200" },
  CORPORATE: { label: "Corporate / Other", icon: Briefcase, tone: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200" },
};

export const contactTypeLabel = (t: string | null | undefined) => TYPES[t ?? "CUSTOMER"]?.label ?? "Customer";

export function ContactTypeIcon({ type, className = "size-4" }: { type: string | null | undefined; className?: string }) {
  const Icon = (TYPES[type ?? "CUSTOMER"] ?? TYPES.CUSTOMER).icon;
  return <Icon className={className} aria-hidden />;
}

export function ContactTypeBadge({ type, compact = false }: { type: string | null | undefined; compact?: boolean }) {
  const t = TYPES[type ?? "CUSTOMER"] ?? TYPES.CUSTOMER;
  const Icon = t.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${t.tone}`} title={t.label}>
      <Icon className="size-3" aria-hidden />
      {!compact && t.label}
    </span>
  );
}

export function RepeatBadge({ partner = false }: { partner?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200" title={partner ? "Repeat partner" : "Repeat customer"}>
      <Star className="size-3 fill-current" aria-hidden />
      {partner ? "Repeat partner" : "Repeat"}
    </span>
  );
}
