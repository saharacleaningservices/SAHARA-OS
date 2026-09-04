"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { restoreRecord, deleteAllDemoData } from "@/server/actions/audit";
import type { EntityType } from "@/server/audit";
import { formatDateTime } from "@/lib/utils";

type Row = Record<string, unknown> & { id: string; deletedAt: string | Date | null; deletedByName: string | null };

const LABELS: Record<EntityType, string> = { Lead: "Leads", Job: "Jobs", Staff: "Staff", Payment: "Payments", Expense: "Expenses" };
const TITLE_KEY: Record<EntityType, string[]> = {
  Lead: ["name", "leadNumber"],
  Job: ["customerName", "jobNumber"],
  Staff: ["name", "employeeCode"],
  Payment: ["clientName", "invoiceNumber"],
  Expense: ["description", "amount"],
};

function rowTitle(entityType: EntityType, row: Row) {
  const [primary, secondary] = TITLE_KEY[entityType];
  return `${row[primary] ?? "—"} · ${row[secondary] ?? ""}`;
}

export function TrashExplorer({ trash, demoCount }: { trash: Record<EntityType, Row[]>; demoCount: number }) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();

  function restore(entityType: EntityType, id: string) {
    startTransition(async () => {
      const res = await restoreRecord(entityType, id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Restored");
      router.refresh();
    });
  }

  function cleanupDemo() {
    startTransition(async () => {
      const res = await deleteAllDemoData();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Removed ${res.total} demo records — moved to Trash`);
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {demoCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5">
          <p className="text-sm text-foreground">
            <span className="font-medium">{demoCount}</span> demo/seed records are still in the system.
          </p>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="size-3.5" /> Delete All Demo Data
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete all demo data?</DialogTitle>
                <DialogDescription>
                  Moves every record flagged as seed/demo data (staff, jobs, payments, expenses) to Trash in one
                  action. Real data you've entered since is never touched. Restorable from this page afterwards.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={cleanupDemo} disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  Delete Demo Data
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <Tabs defaultValue="Lead">
        <TabsList>
          {(Object.keys(LABELS) as EntityType[]).map((t) => (
            <TabsTrigger key={t} value={t}>
              {LABELS[t]} ({trash[t].length})
            </TabsTrigger>
          ))}
        </TabsList>
        {(Object.keys(LABELS) as EntityType[]).map((entityType) => (
          <TabsContent key={entityType} value={entityType} className="space-y-2">
            {trash[entityType].length === 0 ? (
              <EmptyState title={`No deleted ${LABELS[entityType].toLowerCase()}`} />
            ) : (
              trash[entityType].map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{rowTitle(entityType, row)}</p>
                    <p className="text-xs text-muted-foreground">
                      Deleted {formatDateTime(row.deletedAt)} {row.deletedByName ? `by ${row.deletedByName}` : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => restore(entityType, row.id)} disabled={pending}>
                    {pending ? <Loader2 className="animate-spin" /> : <RotateCcw className="size-3.5" />}
                    Restore
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
