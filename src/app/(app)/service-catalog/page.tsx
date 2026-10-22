import { PageHeader } from "@/components/shared/page-header";
import { SectionTabs, PRICE_TABS } from "@/components/shared/section-tabs";
import { requireUser } from "@/lib/current-user";
import { getServiceCatalog } from "@/server/service-catalog";
import { ServiceCatalogEditor } from "@/components/settings/service-catalog-editor";
import { Badge } from "@/components/ui/badge";

// Service Catalog (owner 2026-10-22): the written scope of work, terms & conditions and equipment for each service.
// No prices here (pricing master only). Every role that can open this section may read it; only the Super Admin edits.
const GROUP_LABEL: Record<string, string> = { HOME: "Home", COMMERCIAL: "Commercial", PEST_CONTROL: "Pest control", PAINTING: "Painting" };

export default async function ServiceCatalogPage() {
  const session = await requireUser();
  const entries = await getServiceCatalog();
  const canEdit = session.role === "ADMIN";
  return (
    <div className="space-y-4">
      <PageHeader title="Service Catalog" description="Scope of work, terms & conditions and equipment for every major service — the wording quotations and job cards use. Prices live in the Price List." />
      <SectionTabs tabs={PRICE_TABS} active="/service-catalog" />
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Entries marked <b>Draft</b> use wording prepared for Sahara and still need the owner&apos;s read-through. Approved scope for the Premium / Platinum packages and the customised services is reused exactly from the booking page.
      </p>
      <div className="space-y-3">
        {entries.map((e) => (
          <details key={e.slug} className="rounded-xl border bg-card p-3 [&_summary]:cursor-pointer">
            <summary className="flex flex-wrap items-center justify-between gap-2 font-semibold">
              <span>{e.name}</span>
              <span className="flex items-center gap-1.5">
                <Badge variant="outline">{GROUP_LABEL[e.group] ?? e.group}</Badge>
                {e.reviewed ? <Badge>Approved</Badge> : <Badge variant="outline" className="border-amber-400 text-amber-700">Draft</Badge>}
              </span>
            </summary>
            <div className="mt-3 grid gap-4 text-sm lg:grid-cols-3">
              <section><p className="text-xs font-bold uppercase text-primary">Scope of work</p><ul className="mt-1 list-disc space-y-0.5 pl-4">{e.scopeOfWork.map((x) => <li key={x}>{x}</li>)}</ul></section>
              <section><p className="text-xs font-bold uppercase text-primary">Equipment used</p><ul className="mt-1 list-disc space-y-0.5 pl-4">{e.equipmentsUsed.map((x) => <li key={x}>{x}</li>)}</ul></section>
              <section><p className="text-xs font-bold uppercase text-primary">Terms &amp; conditions</p><ol className="mt-1 list-decimal space-y-0.5 pl-4">{e.termsConditions.map((x) => <li key={x}>{x}</li>)}</ol></section>
            </div>
            {canEdit && <div className="mt-3"><ServiceCatalogEditor slug={e.slug} scopeOfWork={e.scopeOfWork} termsConditions={e.termsConditions} equipmentsUsed={e.equipmentsUsed} reviewed={e.reviewed} /></div>}
            {e.updatedByName && <p className="mt-2 text-xs text-muted-foreground">Last edited by {e.updatedByName}</p>}
          </details>
        ))}
      </div>
    </div>
  );
}
