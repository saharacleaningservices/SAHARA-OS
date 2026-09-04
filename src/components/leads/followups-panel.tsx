"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { addFollowUp, toggleFollowUpDone } from "@/server/actions/leads";
import { formatDateTime } from "@/lib/utils";
import {
  FOLLOWUP_TYPE_OPTIONS,
  FOLLOWUP_TYPE_LABELS,
  FOLLOWUP_PRIORITIES,
  FOLLOWUP_PRIORITY_LABELS,
} from "@/lib/constants";

type FollowUp = {
  id: string;
  dueDate: Date;
  type: string;
  priority: string;
  notes: string | null;
  isDone: boolean;
};

const PRIORITY_TONE: Record<string, "muted" | "warning" | "destructive"> = {
  LOW: "muted",
  MEDIUM: "warning",
  HIGH: "destructive",
};

export function FollowUpsPanel({ leadId, followUps }: { leadId: string; followUps: FollowUp[] }) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [type, setType] = useState("CALL");
  const [priority, setPriority] = useState("MEDIUM");
  const [notes, setNotes] = useState("");
  const router = useRouter();

  function submit() {
    if (!date) {
      toast.error("Pick a follow-up date");
      return;
    }
    startTransition(async () => {
      const res = await addFollowUp(leadId, { dueDate: date, dueTime: time, type, priority, notes });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Follow-up added");
      setShowForm(false);
      setDate("");
      setNotes("");
      router.refresh();
    });
  }

  function toggle(id: string) {
    startTransition(async () => {
      await toggleFollowUpDone(id, leadId);
      router.refresh();
    });
  }

  const open = followUps.filter((f) => !f.isDone);
  const done = followUps.filter((f) => f.isDone);

  return (
    <div className="space-y-3">
      {followUps.length === 0 && !showForm ? (
        <EmptyState title="No follow-ups yet" description="Add a call, WhatsApp, site visit or payment reminder." />
      ) : (
        <div className="space-y-2">
          {[...open, ...done].map((f) => (
            <div key={f.id} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5">
              <Checkbox checked={f.isDone} onCheckedChange={() => toggle(f.id)} disabled={pending} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm ${f.isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {f.notes || `${FOLLOWUP_TYPE_LABELS[f.type] ?? f.type} follow-up`}
                  </p>
                  {!f.isDone && (
                    <Badge variant={PRIORITY_TONE[f.priority] ?? "muted"} className="text-[10px]">
                      {FOLLOWUP_PRIORITY_LABELS[f.priority] ?? f.priority}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {FOLLOWUP_TYPE_LABELS[f.type] ?? f.type} · {formatDateTime(f.dueDate)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOLLOWUP_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOLLOWUP_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {FOLLOWUP_PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Save
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="size-3.5" /> Add follow-up
        </Button>
      )}
    </div>
  );
}
