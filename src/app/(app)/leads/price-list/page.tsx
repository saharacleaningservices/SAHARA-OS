import { PageHeader } from "@/components/shared/page-header";
import { PackageCalculatorButton } from "@/components/layout/package-calculator-dialog";
import { SectionTabs, PRICE_TABS } from "@/components/shared/section-tabs";
import { requireUser } from "@/lib/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceListAccordion } from "@/components/pricing/price-list-accordion";
import { buildShareGroups } from "@/lib/price-share";
import { bookingLink } from "@/lib/social-links";
import { getLivePricing } from "@/server/pricing";
import { getCompanySettings } from "@/server/settings";
import Link from "next/link";

// Staff view of the Sahara pricing master — exactly the prices customers see
// on the landing pages, booking page and WhatsApp catalogue. Read-only here;
// prices change only in src/lib/pricing-master.ts after owner approval.

export default async function PriceListPage() {
  const session = await requireUser();
  const { items, festivals } = await getLivePricing();
  // Customer payment details — view-only for Operations and Accounts (for quotations and
  // collection); only Super Admin can change them, in Settings.
  const canSeePayment = ["ADMIN", "OPERATIONS", "ACCOUNTS"].includes(session.role);
  const pay = canSeePayment ? await getCompanySettings() : null;
  const hasPay = !!(pay && (pay.upiId || pay.upiQrUrl || pay.bankAccountNumber));
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const upcoming = festivals.filter((f) => f.end >= today);
  const shareGroups = buildShareGroups(items, festivals, bookingLink("whatsapp", "share", "price_list"), today);
  return (
    <div className="space-y-4">
      <PageHeader title="Sahara Price List" description="Approved customer prices — the same on the landing pages, booking page, quotations and WhatsApp catalogue. Managed by Super Admin in Pricing & Packages." actions={<PackageCalculatorButton variant="button" />} />
      <SectionTabs tabs={PRICE_TABS} active="/leads/price-list" />
      {upcoming.length > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Festival prices apply to service dates inside: {upcoming.map((f) => `${f.name} (${f.start} → ${f.end})`).join(" · ")}. Regular prices apply on all other dates.
        </p>
      )}
      {canSeePayment && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Customer payment details <span className="font-normal text-muted-foreground">(view only)</span></CardTitle>
            {session.role === "ADMIN" && <Link href="/settings" className="text-xs font-semibold text-primary">Edit in Settings →</Link>}
          </CardHeader>
          <CardContent className="flex flex-wrap items-start gap-4 text-sm">
            {hasPay ? (
              <>
                <div className="min-w-0 space-y-1">
                  {pay?.upiId && <p>UPI ID: <span className="font-semibold">{pay.upiId}</span></p>}
                  {pay?.bankAccountNumber && (
                    <p className="break-words">
                      {pay.bankAccountName ?? "—"} · A/C <span className="font-semibold">{pay.bankAccountNumber}</span>
                      {pay.bankIfsc ? ` · IFSC ${pay.bankIfsc}` : ""}
                      {pay.bankName ? ` · ${pay.bankName}` : ""}
                    </p>
                  )}
                </div>
                {pay?.upiQrUrl && (
                   
                  <img src={pay.upiQrUrl} alt="Payment QR code" className="size-28 rounded-md border bg-white object-contain" />
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Not set yet — Super Admin adds them in Settings.</p>
            )}
          </CardContent>
        </Card>
      )}
      <PriceListAccordion groups={shareGroups} />
    </div>
  );
}
