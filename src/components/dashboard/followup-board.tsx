import Link from "next/link";
import { Clock, AlertTriangle, CalendarDays, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FOLLOWUP_TYPE_LABELS, FOLLOWUP_PRIORITY_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

type FollowUpRow = {
  id: string;
  leadId: string;
  dueDate: Date;
  type: string;
  priority: string;
  notes: string | null;
  lead: { name: string; mobile: string };
};

const PRIORITY_TONE: Record<string, "muted" | "warning" | "destructive"> = {
  LOW: "muted",
  MEDIUM: "warning",
  HIGH: "destructive",
};

function Column({
  title,
  icon,
  items,
  emptyText,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: FollowUpRow[];
  emptyText: string;
  tone: "default" | "destructive";
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`}>
          {icon} {title}
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((f) => (
            <Link
              key={f.id}
              href={`/leads/${f.leadId}`}
              className="block rounded-lg border border-border p-2.5 hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-foreground">{f.lead.name}</p>
                <Badge variant={PRIORITY_TONE[f.priority] ?? "muted"} className="shrink-0 text-[10px]">
                  {FOLLOWUP_PRIORITY_LABELS[f.priority] ?? f.priority}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {FOLLOWUP_TYPE_LABELS[f.type] ?? f.type} · {formatDateTime(f.dueDate)}
              </p>
              {f.notes && <p className="mt-0.5 truncate text-xs text-muted-foreground">{f.notes}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function FollowUpBoard({
  today,
  tomorrow,
  overdue,
}: {
  today: FollowUpRow[];
  tomorrow: FollowUpRow[];
  overdue: FollowUpRow[];
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4" /> Smart Follow-ups
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Column
          title="Overdue"
          icon={<AlertTriangle className="size-3.5" />}
          items={overdue}
          emptyText="Nothing overdue"
          tone="destructive"
        />
        <Column
          title="Today"
          icon={<Clock className="size-3.5" />}
          items={today}
          emptyText="No follow-ups today"
          tone="default"
        />
        <Column
          title="Tomorrow"
          icon={<CalendarDays className="size-3.5" />}
          items={tomorrow}
          emptyText="Nothing tomorrow"
          tone="default"
        />
      </CardContent>
    </Card>
  );
}
