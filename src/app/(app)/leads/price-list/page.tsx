import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PRICE_GROUP_LABEL, PRICING_MASTER, type PriceGroup } from "@/lib/pricing-master";
import { formatINR } from "@/lib/utils";

// Staff view of the Sahara pricing master — exactly the prices customers see
// on the landing pages, booking page and WhatsApp catalogue. Read-only here;
// prices change only in src/lib/pricing-master.ts after owner approval.

export default async function PriceListPage() {
  await requireUser();
  const groups = Object.keys(PRICE_GROUP_LABEL) as PriceGroup[];
  return (
    <div className="space-y-4">
      <PageHeader title="Sahara Price List" description="Approved customer prices — the same on the landing pages, booking page, quotations and WhatsApp catalogue" />
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
                  <TableHead>Unit / minimum</TableHead>
                  <TableHead>Catalogue ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PRICING_MASTER.filter((p) => p.group === g).map((p) => (
                  <TableRow key={p.contentId}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-semibold">{p.price == null ? "After inspection" : formatINR(p.price)}</TableCell>
                    <TableCell className="text-muted-foreground line-through">{p.mrp ? formatINR(p.mrp) : ""}</TableCell>
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
