import { type ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
        {icon ?? <Inbox className="size-6" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}
