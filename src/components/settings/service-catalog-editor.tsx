"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { saveCatalogEntry } from "@/server/actions/service-catalog";

type Props = { slug: string; scopeOfWork: string[]; termsConditions: string[]; equipmentsUsed: string[]; reviewed: boolean };

/** Super Admin: edit one catalog entry (one item per line) and mark it reviewed. */
export function ServiceCatalogEditor(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [scope, setScope] = useState(p.scopeOfWork.join("\n"));
  const [terms, setTerms] = useState(p.termsConditions.join("\n"));
  const [equip, setEquip] = useState(p.equipmentsUsed.join("\n"));
  const [reviewed, setReviewed] = useState(p.reviewed);
  const save = () =>
    start(async () => {
      const res = await saveCatalogEntry({ slug: p.slug, scopeOfWork: scope, termsConditions: terms, equipmentsUsed: equip, reviewed });
      if (!res.success) return void toast.error(res.error);
      toast.success("Catalog entry saved");
      router.refresh();
    });
  return (
    <div className="space-y-3 border-t pt-3">
      <div>
        <Label className="text-xs">Scope of work (one item per line)</Label>
        <Textarea rows={8} value={scope} onChange={(e) => setScope(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Terms &amp; conditions (one per line)</Label>
        <Textarea rows={8} value={terms} onChange={(e) => setTerms(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Equipment used (one per line)</Label>
        <Textarea rows={4} value={equip} onChange={(e) => setEquip(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="size-4" />
        I have read this wording and approve it for customer documents
      </label>
      <Button size="sm" onClick={save} disabled={pending}>{pending && <Loader2 className="size-3.5 animate-spin" />} Save entry</Button>
    </div>
  );
}
