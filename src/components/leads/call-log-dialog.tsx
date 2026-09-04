"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PhoneCall, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CALL_OUTCOMES, CALL_OUTCOME_LABELS } from "@/lib/constants";
import { logCall } from "@/server/actions/leads";

export function CallLogDialog({ leadId, trigger }: { leadId: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!outcome) {
      toast.error("Pick an outcome");
      return;
    }
    startTransition(async () => {
      const res = await logCall(leadId, { outcome, notes });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Call logged");
      setOpen(false);
      setOutcome("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="icon" className="size-9" aria-label="Log a call">
            <PhoneCall className="size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log a Call</DialogTitle>
          <DialogDescription>Record the outcome so it stays in the conversation history.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue placeholder="Select an outcome" />
              </SelectTrigger>
              <SelectContent>
                {CALL_OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {CALL_OUTCOME_LABELS[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
