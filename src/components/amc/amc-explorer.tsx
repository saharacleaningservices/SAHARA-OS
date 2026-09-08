"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, RefreshCcw, ShieldCheck, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { createAmc, recordAmcVisit, cancelAmc, deleteAmc, sendAmcRenewalNow } from "@/server/actions/amc";
import { formatDate, formatINR } from "@/lib/utils";
import {
  AMC_CATEGORY_LABELS,
  AMC_FREQUENCY_LABELS,
  AMC_FREQUENCIES_BY_CATEGORY,
  AMC_STATUS_LABELS,
} from "@/lib/constants";

type AmcRow = {
  id: string;
  contractNumber: string;
  customerName: string;
  customerMobile: string;
  area: string | null;
  address: string | null;
  category: string;
  frequency: string;
  amount: number;
  nextVisitDate: Date;
  lastVisitDate: Date | null;
  serviceReminderDate: Date | null;
  contractExpiryDate: Date | null;
  status: string;
};

export function AmcExplorer({ contracts, canManage }: { contracts: AmcRow[]; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [visitDialogId, setVisitDialogId] = useState<string | null>(null);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [visitNotes, setVisitNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [form, setForm] = useState({
    customerName: "",
    customerMobile: "",
    address: "",
    category: "RESIDENTIAL",
    frequency: "QUARTERLY",
    amount: "",
    startDate: new Date().toISOString().slice(0, 10),
    serviceReminderDate: "",
    contractExpiryDate: "",
    notes: "",
  });

  function submit() {
    startTransition(async () => {
      const res = await createAmc(form);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("AMC contract created");
      setOpen(false);
      setForm({ ...form, customerName: "", customerMobile: "", address: "", amount: "", notes: "", serviceReminderDate: "", contractExpiryDate: "" });
      router.refresh();
    });
  }

  function submitVisit() {
    if (!visitDialogId) return;
    startTransition(async () => {
      const res = await recordAmcVisit(visitDialogId, visitDate, visitNotes);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Visit logged — next visit date updated");
      setVisitDialogId(null);
      setVisitNotes("");
      router.refresh();
    });
  }

  function remind(id: string) {
    startTransition(async () => {
      const res = await sendAmcRenewalNow(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.sent ? "Renewal reminder sent" : "Queued — WhatsApp not configured yet");
    });
  }

  function cancel(id: string) {
    startTransition(async () => {
      await cancelAmc(id);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this AMC contract? Moved to Trash.")) return;
    startTransition(async () => {
      await deleteAmc(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> New AMC Contract
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>New AMC Contract</DialogTitle>
                <DialogDescription>Residential: Quarterly / Half-Yearly / Annual. Commercial: Monthly / Quarterly / Annual.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Customer Name</Label>
                    <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Mobile</Label>
                    <Input value={form.customerMobile} onChange={(e) => setForm({ ...form, customerMobile: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address incl. area & PIN" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm({ ...form, category: v, frequency: AMC_FREQUENCIES_BY_CATEGORY[v][0] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(AMC_CATEGORY_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Frequency</Label>
                    <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(AMC_FREQUENCIES_BY_CATEGORY[form.category] ?? []).map((v) => (
                          <SelectItem key={v} value={v}>{AMC_FREQUENCY_LABELS[v]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Contract Amount (₹)</Label>
                    <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Start Date</Label>
                    <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Service Reminder Date</Label>
                    <Input type="date" value={form.serviceReminderDate} onChange={(e) => setForm({ ...form, serviceReminderDate: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Contract Expiry Reminder</Label>
                    <Input type="date" value={form.contractExpiryDate} onChange={(e) => setForm({ ...form, contractExpiryDate: e.target.value })} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Leave blank to auto-set from frequency (reminder) and a 1-year term (expiry).</p>
                <div className="space-y-1">
                  <Label>Notes (optional)</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />} Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {contracts.length === 0 ? (
        <EmptyState title="No AMC contracts yet" description="Set up recurring maintenance contracts here." icon={<ShieldCheck className="size-5" />} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contract</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Category / Frequency</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Next Visit</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-foreground">{c.contractNumber}</TableCell>
                <TableCell className="text-sm">
                  {c.customerName}
                  <div className="text-xs text-muted-foreground">
                    {c.customerMobile}
                    {c.address ? ` · ${c.address}` : c.area ? ` · ${c.area}` : ""}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{AMC_CATEGORY_LABELS[c.category]} · {AMC_FREQUENCY_LABELS[c.frequency]}</TableCell>
                <TableCell className="text-sm">{formatINR(c.amount)}</TableCell>
                <TableCell className="text-sm">
                  {formatDate(c.serviceReminderDate ?? c.nextVisitDate)}
                  {(() => {
                    const d = c.serviceReminderDate ?? c.nextVisitDate;
                    return d && new Date(d).getTime() <= Date.now() + 7 * 86400000 ? (
                      <div><Badge variant="warning" className="mt-1 text-[10px]">Due soon</Badge></div>
                    ) : null;
                  })()}
                  {c.lastVisitDate && <div className="text-xs text-muted-foreground">Last: {formatDate(c.lastVisitDate)}</div>}
                </TableCell>
                <TableCell className="text-sm">
                  {c.contractExpiryDate ? formatDate(c.contractExpiryDate) : "—"}
                  {c.contractExpiryDate && new Date(c.contractExpiryDate).getTime() <= Date.now() + 30 * 86400000 && (
                    <div><Badge variant="destructive" className="mt-1 text-[10px]">Expiring</Badge></div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={c.status === "ACTIVE" ? "success" : c.status === "EXPIRED" ? "warning" : "muted"}>
                    {AMC_STATUS_LABELS[c.status]}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="icon" className="size-8" title="Log visit" onClick={() => setVisitDialogId(c.id)}>
                        <RefreshCcw className="size-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="size-8" title="Send renewal reminder" onClick={() => remind(c.id)} disabled={pending}>
                        <MessageCircle className="size-3.5" />
                      </Button>
                      {c.status === "ACTIVE" && (
                        <Button variant="outline" size="sm" onClick={() => cancel(c.id)} disabled={pending}>
                          Cancel
                        </Button>
                      )}
                      <Button variant="outline" size="icon" className="size-8 text-destructive" title="Delete" onClick={() => remove(c.id)} disabled={pending}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={visitDialogId !== null} onOpenChange={(o) => !o && setVisitDialogId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log AMC Visit</DialogTitle>
            <DialogDescription>Updates the last visit date and recalculates the next visit date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Visit Date</Label>
              <Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitDialogId(null)}>Cancel</Button>
            <Button onClick={submitVisit} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save Visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
