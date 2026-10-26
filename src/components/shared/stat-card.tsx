import { type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export type StatTone =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "destructive"
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "purple"
  | "teal"
  | "indigo"
  | "gold";

// icon chip background/text + the card's left accent border, per tone.
const TONE: Record<StatTone, { chip: string; border: string }> = {
  default: { chip: "bg-accent text-primary", border: "border-l-border" },
  primary: { chip: "sahara-gradient text-white", border: "border-l-primary" },
  success: { chip: "bg-emerald-500/15 text-emerald-600", border: "border-l-emerald-500" },
  green: { chip: "bg-emerald-500/15 text-emerald-600", border: "border-l-emerald-500" },
  warning: { chip: "bg-amber-500/15 text-amber-600", border: "border-l-amber-500" },
  orange: { chip: "bg-amber-500/15 text-amber-600", border: "border-l-amber-500" },
  destructive: { chip: "bg-red-500/15 text-red-600", border: "border-l-red-500" },
  red: { chip: "bg-red-500/15 text-red-600", border: "border-l-red-500" },
  blue: { chip: "bg-blue-500/15 text-blue-600", border: "border-l-blue-500" },
  purple: { chip: "bg-purple-500/15 text-purple-600", border: "border-l-purple-500" },
  teal: { chip: "bg-teal-500/15 text-teal-600", border: "border-l-teal-500" },
  indigo: { chip: "bg-indigo-500/15 text-indigo-600", border: "border-l-indigo-500" },
  gold: { chip: "bg-yellow-500/15 text-yellow-600", border: "border-l-yellow-500" },
};

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
  tone = "default",
  glow = false,
  className,
  href,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  trend?: number;
  trendLabel?: string;
  tone?: StatTone;
  glow?: boolean;
  className?: string;
  href?: string;
}) {
  const t = TONE[tone] ?? TONE.default;

  const inner = (
    <>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon && (
          <div className={cn("flex size-9 items-center justify-center rounded-lg", t.chip)}>{icon}</div>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[1.7rem] font-bold leading-none tracking-tight text-foreground">{value}</p>
        {typeof trend === "number" && (
          <span
            className={cn(
              "mb-1 flex items-center gap-0.5 text-xs font-medium",
              trend >= 0 ? "text-emerald-600" : "text-red-600",
            )}
          >
            {trend >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {trendLabel && <p className="-mt-1 text-xs text-muted-foreground">{trendLabel}</p>}
    </>
  );

  const base = cn(
    "flex flex-col gap-3 rounded-xl border border-l-4 border-border bg-card p-4 sahara-shadow",
    t.border,
    glow && "ring-2 ring-primary/40",
    href && "transition hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40",
    className,
  );

  return href ? (
    <Link href={href} className={base}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}
