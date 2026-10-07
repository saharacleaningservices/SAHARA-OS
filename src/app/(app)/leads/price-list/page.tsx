import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PRICE_GROUP_LABEL, type PriceGroup } from "@/lib/pricing-master";
import { getLivePricing } from "@/server/pricing";
import { formatINR } from "@/lib/utils";
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
  const groups = Object.keys(PRICE_GROUP_LABEL) as PriceGroup[];
  return (
    <div className="space-y-4">
      <PageHeader title="Sahara Price List" description="Approved customer prices — the same on the landing pages, booking page, quotations and WhatsApp catalogue. Managed by Super Admin in Pricing & Packages." />
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
      {groups.map((g) => (
        <Card key={g}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{PRICE_GROUP_LABEL[g]}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Strike (MRP)</TableHead>
                  {upcoming.map((f) => (
                    <TableHead key={f.id}>{f.name} price</TableHead>
                  ))}
                  <TableHead>Unit / minimum</TableHead>
                  <TableHead>Catalogue ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.filter((p) => p.group === g).map((p) => (
                  <TableRow key={p.contentId}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-semibold">{p.price == null ? "After inspection" : formatINR(p.price)}</TableCell>
                    <TableCell className="text-muted-foreground line-through">{p.mrp ? formatINR(p.mrp) : ""}</TableCell>
                    {upcoming.map((f) => (
                      <TableCell key={f.id} className="font-semibold text-amber-800">{f.prices[p.contentId] != null ? formatINR(f.prices[p.contentId]) : "—"}</TableCell>
                    ))}
                    <TableCell className="text-sm text-muted-foreground">{[p.unit, p.rule].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.contentId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
