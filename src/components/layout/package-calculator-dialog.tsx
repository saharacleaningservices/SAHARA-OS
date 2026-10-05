"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calculator, Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PackageCalculator } from "@/components/shared/package-calculator";
import { EMPTY_PACKAGE, packageTotals, serializeLines, type PackageDraft } from "@/lib/package-calc";
import { attachPackageToLead, getPackageCalculatorAccess, searchLeadsForPackage } from "@/server/actions/package";

/** Header CRM utility: build a package, then attach it to an open lead or start a new lead with it. */
export function PackageCalculatorButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<{ canEditPrice: boolean } | null>(null);
  const [pkg, setPkg] = useState<PackageDraft>(EMPTY_PACKAGE);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; leadNumber: string; name: string; area: string; stage: string }[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open && !access) getPackageCalculatorAccess().then(setAccess).catch(() => {});
  }, [open, access]);
  useEffect(() => {
    if (q.trim().length < 2) return void setResults([]);
    const t = setTimeout(() => searchLeadsForPackage(q).then(setResults).catch(() => setResults([])), 300);
    return () => clearTimeout(t);
  }, [q]);

  const total = packageTotals(pkg);
  const ready = pkg.lines.length > 0;

  function attach(leadId: string) {
    start(async () => {
      const res = await attachPackageToLead(leadId, serializeLines(pkg), total.discount);
      if ("error" in res && res.error) return void toast.error(res.error);
      if ("leadNumber" in res) toast.success(`Package attached to ${res.leadNumber} — ₹${(res.final ?? 0).toLocaleString("en-IN")}`);
      setOpen(false);
      setPkg(EMPTY_PACKAGE);
      router.push(`/leads/${leadId}`);
    });
  }
  function newLead() {
    try {
      sessionStorage.setItem("sahara_pkg_draft", JSON.stringify(pkg));
    } catch {
      /* storage unavailable */
    }
    setOpen(false);
    router.push("/leads/new");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40"
      >
        <Calculator className="size-3.5 text-primary" /> Package Calculator
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Package Calculator</DialogTitle>
          </DialogHeader>
          {!access ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              <PackageCalculator value={pkg} onChange={setPkg} canEditPrice={access.canEditPrice} />
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm font-semibold">Save / attach</p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Attach to open lead — name, mobile or LD-number" className="pl-8" disabled={!ready} />
                </div>
                {results.length > 0 && (
                  <ul className="divide-y rounded-md border text-sm">
                    {results.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                        <span className="min-w-0 truncate">
                          <span className="font-mono text-xs text-muted-foreground">{r.leadNumber}</span> {r.name} · {r.area}
                        </span>
                        <Button size="sm" variant="outline" disabled={pending || !ready} onClick={() => attach(r.id)}>
                          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Attach
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button className="w-full" variant="secondary" disabled={!ready} onClick={newLead}>
                  <UserPlus className="size-4" /> New lead with this package
                </Button>
                <p className="text-[11px] text-muted-foreground">Uses the live price list. Only open leads (not yet booked) can take a package; after booking, change the job.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
