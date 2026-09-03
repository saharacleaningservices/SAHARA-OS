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
import { EmptyState } from "@/components/shared/empty-state";
import { addFollowUp, toggleFollowUpDone } from "@/server/actions/leads";
import { formatDateTime } from "@/lib/utils";

type FollowUp = {
  id: string;
  dueDate: Date;
  type: string;
  notes: string | null;
  isDone: boolean;
};

export function FollowUpsPanel({ leadId, followUps }: { leadId: string; followUps: FollowUp[] }) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState("CALL");
  const [notes, setNotes] = useState("");
  const router = useRouter();

  function submit() {
    if (!dueDate) {
      toast.error("Pick a due date");
      return;
    }
    startTransition(async () => {
      await addFollowUp(leadId, dueDate, type, notes);
      toast.success("Follow-up added");
      setShowForm(false);
      setDueDate("");
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

  return (
    <div className="space-y-3">
      {followUps.length === 0 && !showForm ? (
        <EmptyState title="No follow-ups yet" description="Add a call, WhatsApp, visit or email reminder." />
      ) : (
        <div className="space-y-2">
          {followUps.map((f) => (
            <div key={f.id} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5">
              <Checkbox checked={f.isDone} onCheckedChange={() => toggle(f.id)} disabled={pending} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${f.isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {f.notes || "Follow up"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {f.type} · {formatDateTime(f.dueDate)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CALL">Call</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="VISIT">Visit</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
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
