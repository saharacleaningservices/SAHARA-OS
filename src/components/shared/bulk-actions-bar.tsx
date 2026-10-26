"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type ActionResult = { error?: string; success?: boolean; count?: number };

/** Sticky "N selected" bar with a soft-delete action, shown above a table. */
export function BulkActionsBar({
  count,
  entityLabel,
  onDelete,
  onClear,
  children,
}: {
  count: number;
  entityLabel: string;
  onDelete: () => Promise<ActionResult>;
  onClear: () => void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (count === 0) return null;

  function confirmDelete() {
    startTransition(async () => {
      const res = await onDelete();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted ${res?.count ?? count} ${entityLabel}${(res?.count ?? count) === 1 ? "" : "s"}`);
      setOpen(false);
      onClear();
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <p className="text-sm font-medium text-foreground">
          {count} {entityLabel}
          {count === 1 ? "" : "s"} selected
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {children}
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <X className="size-3.5" /> Clear
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
            <Trash2 className="size-3.5" /> Delete Selected
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {count} {entityLabel}{count === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              Moved to Trash — an admin can restore them later. This does not permanently erase the data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
