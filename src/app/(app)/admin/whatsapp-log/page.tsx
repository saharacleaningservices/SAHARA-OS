import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";
import { isWhatsAppReady, listOptedOutNumbers } from "@/lib/whatsapp";
import { isSmsReady } from "@/lib/sms";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { WhatsAppConsentCard } from "@/components/settings/whatsapp-consent-card";
import { formatDateTime } from "@/lib/utils";
import { Info } from "lucide-react";

export default async function MessageLogPage() {
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const [waReady, smsReady, waMsgs, smsMsgs, optedOut] = await Promise.all([
    isWhatsAppReady(),
    isSmsReady(),
    db.whatsAppMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    db.smsMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 }).catch(() => []),
    listOptedOutNumbers(),
  ]);

  const rows = [
    ...waMsgs.map((m) => ({
      id: m.id,
      channel: "WhatsApp",
      createdAt: m.createdAt,
      kind: m.kind,
      to: `${m.toName ? `${m.toName} · ` : ""}${m.toNumber}`,
      body: m.body,
      status: m.status,
      error: m.errorMessage ?? null,
    })),
    ...smsMsgs.map((m) => ({
      id: m.id,
      channel: "SMS",
      createdAt: m.createdAt,
      kind: m.kind,
      to: `${m.toName ? `${m.toName} · ` : ""}${m.toNumber}`,
      body: m.body,
      status: m.status,
      error: m.error ?? null,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="space-y-6">
      <PageHeader title="Message Log" description="Every automated WhatsApp & SMS message the CRM has sent or queued" />

      {(!waReady || !smsReady) && (
        <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            {!waReady && <>WhatsApp Cloud API not connected. </>}
            {!smsReady && <>SMS gateway not connected. </>}
            Queued messages flush automatically the moment credentials are saved in{" "}
            <a href="/settings" className="font-medium text-primary hover:underline">Settings → Integrations</a> —
            no code change needed. Failed sends are retried by the daily cron.
          </p>
        </div>
      )}

      <WhatsAppConsentCard optedOut={optedOut} />

      {rows.length === 0 ? (
        <EmptyState title="No messages yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={`${m.channel}-${m.id}`}>
                <TableCell className="whitespace-nowrap text-sm">{formatDateTime(m.createdAt)}</TableCell>
                <TableCell className="text-sm">
                  <Badge variant={m.channel === "WhatsApp" ? "success" : "muted"}>{m.channel}</Badge>
                </TableCell>
                <TableCell className="text-sm">{m.kind.replaceAll("_", " ")}</TableCell>
                <TableCell className="text-sm">{m.to}</TableCell>
                <TableCell className="max-w-md truncate text-sm text-muted-foreground" title={m.body}>
                  {m.body}
                </TableCell>
                <TableCell>
                  <Badge variant={m.status === "SENT" ? "success" : m.status === "FAILED" ? "destructive" : "muted"}>
                    {m.status}
                  </Badge>
                  {m.error && <p className="mt-1 max-w-[200px] truncate text-xs text-destructive" title={m.error}>{m.error}</p>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
