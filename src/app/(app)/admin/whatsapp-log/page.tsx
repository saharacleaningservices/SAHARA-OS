import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";
import { isWhatsAppConfigured } from "@/lib/whatsapp";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/utils";
import { Info } from "lucide-react";

export default async function WhatsAppLogPage() {
  await requireRole(["ADMIN"]);
  const configured = isWhatsAppConfigured();
  const messages = await db.whatsAppMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp Log" description="Every automated WhatsApp message the CRM has sent or queued" />

      {!configured && (
        <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-medium">WhatsApp Cloud API isn&apos;t connected yet</span> — messages below are
            queued, not sent. Set <code>WHATSAPP_ACCESS_TOKEN</code> and <code>WHATSAPP_PHONE_NUMBER_ID</code> (from
            your Meta Business/WhatsApp Cloud API app) on Render to start sending — sends resume automatically, no
            code change needed.
          </p>
        </div>
      )}

      {messages.length === 0 ? (
        <EmptyState title="No WhatsApp messages yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap text-sm">{formatDateTime(m.createdAt)}</TableCell>
                <TableCell className="text-sm">{m.kind.replaceAll("_", " ")}</TableCell>
                <TableCell className="text-sm">
                  {m.toName ? `${m.toName} · ` : ""}{m.toNumber}
                </TableCell>
                <TableCell className="max-w-md truncate text-sm text-muted-foreground" title={m.body}>
                  {m.body}
                </TableCell>
                <TableCell>
                  <Badge variant={m.status === "SENT" ? "success" : m.status === "FAILED" ? "destructive" : "muted"}>
                    {m.status}
                  </Badge>
                  {m.errorMessage && <p className="mt-1 text-xs text-destructive">{m.errorMessage}</p>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
