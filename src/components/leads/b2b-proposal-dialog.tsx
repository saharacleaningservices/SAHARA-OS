"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createQuotation } from "@/server/actions/leads";
import { formatINR } from "@/lib/utils";
import { DRAFT_B2B_TERMS, SITE_TYPES, SITE_TYPE_LABEL, proposalItems, proposalTerms, validateBrief, type B2bBrief, type SiteType, type StaffLine } from "@/lib/b2b-proposal";

/**
 * B2B facility-management / housekeeping AMC proposal. Builds an ordinary Quotation (same access rules,
 * numbering, PDF and booking link) with staffing line items and a scope-of-work + terms block.
 * Rates are entered here by Admin/Accounts; nothing is priced automatically.
 */
export function B2bProposalDialog({ leadId, leadName, area }: { leadId: string; leadName: string; area?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [siteType, setSiteType] = useState<SiteType>("OFFICE");
  const [siteName, setSiteName] = useState(leadName);
  const [siteAddress, setSiteAddress] = useState(area ?? "");
  const [areaSqft, setAreaSqft] = useState<number | "">("");
  const [daysPerWeek, setDaysPerWeek] = useState(6);
  const [shiftHours, setShiftHours] = useState(8);
  const [contractMonths, setContractMonths] = useState(12);
  const [consumablesByClient, setConsumablesByClient] = useState(false);
  const [staff, setStaff] = useState<StaffLine[]>([{ role: "Housekeeping staff", count: 1, monthlyRate: 0 }]);
  const [extraScope, setExtraScope] = useState("");
  const [terms, setTerms] = useState(DRAFT_B2B_TERMS);
  const [gstPercent, setGstPercent] = useState(18);

  const brief: B2bBrief = { siteType, siteName, siteAddress, areaSqft: areaSqft || undefined, daysPerWeek, shiftHours, staff, consumablesByClient, contractMonths, extraScope, terms };
  const monthly = staff.reduce((s, l) => s + (Number(l.count) || 0) * (Number(l.monthlyRate) || 0), 0);
  const gst = Math.round(((monthly * gstPercent) / 100) * 100) / 100;

  const setLine = (i: number, patch: Partial<StaffLine>) => setStaff((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function submit() {
    const v = validateBrief(brief);
    if (!v.ok) return void toast.error(v.error);
    startTransition(async () => {
      const res = await createQuotation(leadId, proposalItems(brief), gstPercent, 0, { terms: proposalTerms(brief), validDays: 15 });
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success("B2B proposal created as a quotation");
      setOpen(false);
      router.refresh();
      if ("quotationId" in res && res.quotationId) window.open(`/api/quotations/${res.quotationId}/pdf`, "_blank");
    });
  }

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Building2 className="size-3.5" /> B2B / AMC Proposal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Facility management / AMC proposal</DialogTitle>
          <DialogDescription>Staffing, scope of work and terms go into a quotation and its PDF (valid 15 days).</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="b2b-type">Site type</Label>
              <select id="b2b-type" value={siteType} onChange={(e) => setSiteType(e.target.value as SiteType)} className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2">
                {SITE_TYPES.map((t) => (
                  <option key={t} value={t}>{SITE_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="b2b-name">Site / client name</Label>
              <Input id="b2b-name" className="mt-1" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="b2b-addr">Address / area</Label>
              <Input id="b2b-addr" className="mt-1" value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="b2b-sqft">Area (sq ft, optional)</Label>
              <Input id="b2b-sqft" className="mt-1" inputMode="numeric" value={areaSqft} onChange={(e) => setAreaSqft(e.target.value === "" ? "" : num(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="b2b-days">Days/week</Label>
              <Input id="b2b-days" className="mt-1" type="number" min={1} max={7} value={daysPerWeek} onChange={(e) => setDaysPerWeek(num(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="b2b-shift">Shift (h)</Label>
              <Input id="b2b-shift" className="mt-1" type="number" min={4} max={12} value={shiftHours} onChange={(e) => setShiftHours(num(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="b2b-months">Contract (months)</Label>
              <Input id="b2b-months" className="mt-1" type="number" min={1} max={36} value={contractMonths} onChange={(e) => setContractMonths(num(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Staffing (monthly rate per person — enter your approved rate)</Label>
            {staff.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_4.5rem_6.5rem_auto] items-center gap-2">
                <Input aria-label="Role" value={l.role} onChange={(e) => setLine(i, { role: e.target.value })} placeholder="Role" />
                <Input aria-label="Count" type="number" min={1} value={l.count} onChange={(e) => setLine(i, { count: num(e.target.value) })} />
                <Input aria-label="Monthly rate (₹)" inputMode="numeric" value={l.monthlyRate || ""} onChange={(e) => setLine(i, { monthlyRate: num(e.target.value) })} placeholder="₹/month" />
                <Button variant="ghost" size="icon" aria-label="Remove line" disabled={staff.length === 1} onClick={() => setStaff((p) => p.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setStaff((p) => [...p, { role: "Supervisor", count: 1, monthlyRate: 0 }])}>
              <Plus className="size-3.5" /> Add staff line
            </Button>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={consumablesByClient} onChange={(e) => setConsumablesByClient(e.target.checked)} />
            Client supplies consumables and chemicals
          </label>

          <div>
            <Label htmlFor="b2b-extra">Additional scope (optional)</Label>
            <textarea id="b2b-extra" rows={2} value={extraScope} onChange={(e) => setExtraScope(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-card p-2" />
          </div>
          <div>
            <Label htmlFor="b2b-terms">Terms (draft — owner to approve the standard wording)</Label>
            <textarea id="b2b-terms" rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-card p-2 font-mono text-xs" />
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="b2b-gst">GST %</Label>
            <Input id="b2b-gst" className="w-20" type="number" min={0} max={28} value={gstPercent} onChange={(e) => setGstPercent(num(e.target.value))} />
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="flex justify-between"><span>Monthly charge</span><span>{formatINR(monthly)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>GST ({gstPercent}%)</span><span>{formatINR(gst)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total per month</span><span>{formatINR(monthly + gst)}</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />} Create proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
