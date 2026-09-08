import { type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
  tone = "default",
  className,
  href,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  trend?: number;
  trendLabel?: string;
  tone?: "default" | "primary" | "success" | "warning" | "destructive";
  className?: string;
  href?: string;
}) {
  const toneStyles: Record<string, string> = {
    default: "bg-accent text-primary",
    primary: "sahara-gradient text-white",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
  };

  const inner = (
    <>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon && (
          <div className={cn("flex size-9 items-center justify-center rounded-lg", toneStyles[tone])}>
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {typeof trend === "number" && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium mb-1",
              trend >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {trend >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {trendLabel && <p className="text-xs text-muted-foreground -mt-2">{trendLabel}</p>}
    </>
  );

  const base = cn(
    "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sahara-shadow",
    href && "transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
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
