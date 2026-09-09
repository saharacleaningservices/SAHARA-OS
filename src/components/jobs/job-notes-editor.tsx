"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateJobNotes } from "@/server/actions/jobs";

/** Inline job notes / remarks editor shown on the job detail page. Usable by
 * the Field Coordinator and every office role — the full job edit form stays
 * manager-only. */
export function JobNotesEditor({ jobId, notes }: { jobId: string; notes: string | null }) {
  const [value, setValue] = useState(notes ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = value.trim() !== (notes ?? "").trim();

  function save() {
    startTransition(async () => {
      const res = await updateJobNotes(jobId, value);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Job notes saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Progress updates, site remarks, customer requests…"
        maxLength={2000}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={pending || !dirty}>
          {pending ? <Loader2 className="animate-spin" /> : <NotebookPen className="size-3.5" />} Save Notes
        </Button>
      </div>
    </div>
  );
}
