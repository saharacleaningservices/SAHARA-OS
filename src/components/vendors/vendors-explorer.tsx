"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calculator, Handshake, IndianRupee, Loader2, Pencil, Phone, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { recordVendorPayout, saveVendor, setVendorActive } from "@/server/actions/vendors";
import { COMMISSION_DEFAULT, COMMISSION_MAX, COMMISSION_MIN, splitCommission } from "@/lib/vendor-commission";
import { formatDate, formatINR } from "@/lib/utils";
import type { PayoutRow, VendorRow } from "@/server/vendors";

const PCT_STEPS = [20, 21, 22, 23, 24, 25];
const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";

type VendorForm = { id: string | null; name: string; phone: string; services: string[]; extra: string; commissionPct: string; notes: string };
const EMPTY_VENDOR: VendorForm = { id: null, name: "", phone: "", services: [], extra: "", commissionPct: String(COMMISSION_DEFAULT), notes: "" };

type PayoutForm = { vendorId: string; service: string; jobRef: string; grossAmount: string; commissionPct: string; paidDate: string; mode: string; notes: string };

const today = () => new Date().toISOString().slice(0, 10);

/** Live split: Sahara share / vendor share for a job value and a 20–25 % commission. */
function SplitPreview({ gross, pct }: { gross: string; pct: string }) {
  const s = splitCommission(Number(gross) || 0, Number(pct));
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 dark:border-teal-900 dark:bg-teal-950/40">
        <p className="text-xs font-medium text-teal-800 dark:text-teal-300">Sahara keeps · {s.commissionPct}%</p>
        <p className="text-lg font-bold tabular-nums text-teal-900 dark:text-teal-100">{formatINR(s.saharaShare)}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Vendor gets · {s.vendorPct}%</p>
        <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatINR(s.vendorShare)}</p>
      </div>
    </div>
  );
}

function PctSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={select}>
      {PCT_STEPS.map((p) => (
        <option key={p} value={p}>
          {p}% / {100 - p}%
        </option>
      ))}
    </select>
  );
}

export function VendorsExplorer({ vendors, payouts, serviceOptions }: { vendors: VendorRow[]; payouts: PayoutRow[]; serviceOptions: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vf, setVf] = useState<VendorForm>(EMPTY_VENDOR);
  const [payOpen, setPayOpen] = useState(false);
  const [pf, setPf] = useState<PayoutForm | null>(null);
  const [calc, setCalc] = useState({ gross: "10000", pct: String(COMMISSION_DEFAULT) });
  const [showInactive, setShowInactive] = useState(false);

  const list = useMemo(() => vendors.filter((v) => showInactive || v.active), [vendors, showInactive]);
  const totals = useMemo(
    () => vendors.reduce((a, v) => ({ gross: a.gross + v.grossTotal, sahara: a.sahara + v.saharaTotal, paid: a.paid + v.paidTotal }), { gross: 0, sahara: 0, paid: 0 }),
    [vendors],
  );

  function openVendor(v?: VendorRow) {
    if (!v) setVf(EMPTY_VENDOR);
    else {
      const std = v.services.filter((s) => serviceOptions.includes(s));
      setVf({ id: v.id, name: v.name, phone: v.phoneE164 || v.phone, services: std, extra: v.services.filter((s) => !std.includes(s)).join(", "), commissionPct: String(v.commissionPct), notes: v.notes ?? "" });
    }
    setVendorOpen(true);
  }

  function openPayout(v: VendorRow) {
    setPf({ vendorId: v.id, service: v.services[0] ?? "", jobRef: "", grossAmount: "", commissionPct: String(v.commissionPct), paidDate: today(), mode: "UPI", notes: "" });
    setPayOpen(true);
  }

  function submitVendor() {
    const services = [...vf.services, ...vf.extra.split(",").map((s) => s.trim()).filter(Boolean)];
    startTransition(async () => {
      const res = await saveVendor(vf.id, { name: vf.name, phone: vf.phone, services, commissionPct: vf.commissionPct, notes: vf.notes });
      if (!res.success) return void toast.error(res.error);
      toast.success(vf.id ? "Vendor updated" : "Vendor registered");
      setVendorOpen(false);
      router.refresh();
    });
  }

  function submitPayout() {
    if (!pf) return;
    startTransition(async () => {
      const res = await recordVendorPayout(pf);
      if (!res.success) return void toast.error(res.error);
      toast.success("Payout recorded · added to Purchases & Expenses as Vendor Payment");
      setPayOpen(false);
      router.refresh();
    });
  }

  function toggle(v: VendorRow) {
    startTransition(async () => {
      const res = await setVendorActive(v.id, !v.active);
      if (!res.success) return void toast.error(res.error);
      router.refresh();
    });
  }

  const payVendor = pf ? vendors.find((v) => v.id === pf.vendorId) : undefined;

  return (
    <div className="w-full space-y-5">
      {/* KPI strip + calculator */}
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-[1fr_1fr_1fr_1.6fr] lg:items-start">
        {[
          { label: "Job value via vendors", value: totals.gross, icon: Handshake },
          { label: "Sahara commission earned", value: totals.sahara, icon: IndianRupee },
          { label: "Paid to vendors", value: totals.paid, icon: Wallet },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <k.icon className="hidden size-4 shrink-0 text-teal-700 sm:block" /> {k.label}
            </div>
            <p className="mt-1 text-base font-bold tabular-nums sm:text-2xl">{formatINR(k.value)}</p>
          </div>
        ))}
        <div className="col-span-3 rounded-2xl border bg-card p-4 shadow-sm lg:col-span-1">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Calculator className="size-4 text-teal-700" /> Commission calculator
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="calc-gross" className="text-xs">Job value (₹)</Label>
              <Input id="calc-gross" inputMode="numeric" value={calc.gross} onChange={(e) => setCalc({ ...calc, gross: e.target.value.replace(/[^\d.]/g, "") })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="calc-pct" className="text-xs">Sahara / Vendor</Label>
              <PctSelect id="calc-pct" value={calc.pct} onChange={(pct) => setCalc({ ...calc, pct })} />
            </div>
          </div>
          <SplitPreview gross={calc.gross} pct={calc.pct} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive vendors
        </label>
        <Button onClick={() => openVendor()}>
          <Plus className="size-4" /> Register Vendor
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Handshake className="size-6" />} title="No vendors yet" description="Register partner vendors with their service packages and commission split." />
      ) : (
        <>
          {/* Desktop: fluid slate table */}
          <div className="hidden overflow-hidden rounded-2xl border shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-left text-xs uppercase tracking-wide text-slate-100">
                <tr>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Service packages</th>
                  <th className="px-4 py-3 text-right">Split</th>
                  <th className="px-4 py-3 text-right">Jobs</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Job value</th>
                  <th className="px-4 py-3 text-right">Sahara</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {list.map((v, i) => (
                  <tr key={v.id} className={i % 2 ? "bg-slate-50/70 dark:bg-slate-900/40" : "bg-card"}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{v.name} {!v.active && <Badge variant="outline" className="ml-1">Inactive</Badge>}</div>
                      <a href={`tel:${v.phoneE164}`} className="text-xs text-muted-foreground hover:underline">{v.phoneE164 || v.phone}</a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">{v.services.length ? v.services.map((s) => <Badge key={s} variant="secondary">{s}</Badge>) : <span className="text-muted-foreground">—</span>}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{v.commissionPct}% / {100 - v.commissionPct}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.jobs}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatINR(v.grossTotal)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-teal-800 dark:text-teal-300">{formatINR(v.saharaTotal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatINR(v.paidTotal)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => openPayout(v)} disabled={!v.active}><Wallet className="size-3.5" /> Payout</Button>
                        <Button size="sm" variant="outline" onClick={() => openVendor(v)} aria-label={`Edit ${v.name}`}><Pencil className="size-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => toggle(v)} disabled={pending}>{v.active ? "Deactivate" : "Activate"}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: narrow cards */}
          <div className="space-y-3 md:hidden">
            {list.map((v) => (
              <div key={v.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{v.name}</p>
                    <a href={`tel:${v.phoneE164}`} className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" /> {v.phoneE164 || v.phone}</a>
                  </div>
                  <Badge variant={v.active ? "secondary" : "outline"}>{v.active ? `${v.commissionPct}% / ${100 - v.commissionPct}%` : "Inactive"}</Badge>
                </div>
                {v.services.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{v.services.map((s) => <Badge key={s} variant="outline" className="text-[11px]">{s}</Badge>)}</div>}
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 text-center text-xs dark:bg-slate-900">
                  <div><p className="text-muted-foreground">Jobs</p><p className="font-semibold tabular-nums">{v.jobs}</p></div>
                  <div><p className="text-muted-foreground">Sahara</p><p className="font-semibold tabular-nums text-teal-800 dark:text-teal-300">{formatINR(v.saharaTotal)}</p></div>
                  <div><p className="text-muted-foreground">Paid</p><p className="font-semibold tabular-nums">{formatINR(v.paidTotal)}</p></div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button size="sm" className="h-10" onClick={() => openPayout(v)} disabled={!v.active}>Payout</Button>
                  <Button size="sm" variant="outline" className="h-10" onClick={() => openVendor(v)}>Edit</Button>
                  <Button size="sm" variant="ghost" className="h-10" onClick={() => toggle(v)} disabled={pending}>{v.active ? "Deactivate" : "Activate"}</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Payout history */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Recent payouts</h2>
        {payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payouts recorded yet. Each payout is also added to Purchases &amp; Expenses as a Vendor Payment.</p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Vendor</th><th className="px-4 py-2.5">Service / Job</th>
                    <th className="px-4 py-2.5 text-right">Job value</th><th className="px-4 py-2.5 text-right">Sahara</th><th className="px-4 py-2.5 text-right">Paid</th><th className="px-4 py-2.5">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payouts.map((p) => (
                    <tr key={p.id} className={p.expenseLive ? "" : "text-muted-foreground line-through"}>
                      <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(p.paidDate)}</td>
                      <td className="px-4 py-2.5">{p.vendorName}</td>
                      <td className="px-4 py-2.5">{[p.service, p.jobRef].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(p.grossAmount)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(p.saharaShare)} <span className="text-xs text-muted-foreground">({p.commissionPct}%)</span></td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatINR(p.vendorShare)}</td>
                      <td className="px-4 py-2.5">{p.mode ?? "—"}{!p.expenseLive && " · expense deleted"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {payouts.map((p) => (
                <div key={p.id} className={`rounded-xl border bg-card p-3 text-sm ${p.expenseLive ? "" : "opacity-60"}`}>
                  <div className="flex justify-between gap-2"><span className="font-medium">{p.vendorName}</span><span className="font-semibold tabular-nums">{formatINR(p.vendorShare)}</span></div>
                  <div className="mt-0.5 flex justify-between gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(p.paidDate)} · {[p.service, p.jobRef].filter(Boolean).join(" · ") || "—"}</span>
                    <span>Sahara {formatINR(p.saharaShare)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Register / edit vendor */}
      <Dialog open={vendorOpen} onOpenChange={setVendorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{vf.id ? "Edit Vendor" : "Register Vendor"}</DialogTitle>
            <DialogDescription>Mobile number is the vendor&apos;s unique key. International numbers are kept with their country code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="v-name">Vendor name</Label>
              <Input id="v-name" value={vf.name} onChange={(e) => setVf({ ...vf, name: e.target.value })} placeholder="e.g. Shine Pest Solutions" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-phone">Mobile</Label>
              <Input id="v-phone" type="tel" value={vf.phone} onChange={(e) => setVf({ ...vf, phone: e.target.value })} placeholder="98XXXXXXXX or +61…" />
            </div>
            <div className="space-y-1.5">
              <Label>Service packages</Label>
              <div className="flex flex-wrap gap-1.5">
                {serviceOptions.map((s) => {
                  const on = vf.services.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => setVf({ ...vf, services: on ? vf.services.filter((x) => x !== s) : [...vf.services, s] })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${on ? "border-teal-700 bg-teal-700 text-white" : "bg-background"}`} aria-pressed={on}>
                      {s}
                    </button>
                  );
                })}
              </div>
              <Input value={vf.extra} onChange={(e) => setVf({ ...vf, extra: e.target.value })} placeholder="Other packages, comma separated (e.g. Facade Glass, Termite)" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-pct">Commission split (Sahara / Vendor)</Label>
              <PctSelect id="v-pct" value={vf.commissionPct} onChange={(commissionPct) => setVf({ ...vf, commissionPct })} />
              <p className="text-xs text-muted-foreground">Sahara {COMMISSION_MIN}–{COMMISSION_MAX}% · default {COMMISSION_DEFAULT}%. Can be changed per payout.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-notes">Notes</Label>
              <Input id="v-notes" value={vf.notes} onChange={(e) => setVf({ ...vf, notes: e.target.value })} placeholder="Bank / UPI ID, areas covered…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVendorOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submitVendor} disabled={pending}>{pending && <Loader2 className="size-3.5 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payout */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record payout{payVendor ? ` · ${payVendor.name}` : ""}</DialogTitle>
            <DialogDescription>The vendor&apos;s share is added to Purchases &amp; Expenses as a Vendor Payment.</DialogDescription>
          </DialogHeader>
          {pf && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="p-gross">Job value (₹)</Label>
                  <Input id="p-gross" inputMode="numeric" value={pf.grossAmount} onChange={(e) => setPf({ ...pf, grossAmount: e.target.value.replace(/[^\d.]/g, "") })} placeholder="e.g. 12000" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="p-pct">Sahara / Vendor</Label>
                  <PctSelect id="p-pct" value={pf.commissionPct} onChange={(commissionPct) => setPf({ ...pf, commissionPct })} />
                </div>
              </div>
              <SplitPreview gross={pf.grossAmount} pct={pf.commissionPct} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="p-service">Service</Label>
                  <select id="p-service" value={pf.service} onChange={(e) => setPf({ ...pf, service: e.target.value })} className={select}>
                    <option value="">—</option>
                    {[...new Set([...(payVendor?.services ?? []), ...serviceOptions])].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="p-job">Job no. / site</Label>
                  <Input id="p-job" value={pf.jobRef} onChange={(e) => setPf({ ...pf, jobRef: e.target.value })} placeholder="SCS-J-…" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="p-date">Paid on</Label>
                  <Input id="p-date" type="date" value={pf.paidDate} onChange={(e) => setPf({ ...pf, paidDate: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="p-mode">Mode</Label>
                  <select id="p-mode" value={pf.mode} onChange={(e) => setPf({ ...pf, mode: e.target.value })} className={select}>
                    <option value="UPI">UPI</option><option value="BANK">Bank transfer</option><option value="CASH">Cash</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-notes">Notes</Label>
                <Input id="p-notes" value={pf.notes} onChange={(e) => setPf({ ...pf, notes: e.target.value })} placeholder="UTR / reference" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submitPayout} disabled={pending || !pf || !(Number(pf.grossAmount) > 0)}>{pending && <Loader2 className="size-3.5 animate-spin" />} Record payout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
