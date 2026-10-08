import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";
import { isWhatsAppReady, listOptedOutNumbers, previewPendingWhatsApp } from "@/lib/whatsapp";
import { isSmsReady } from "@/lib/sms";
import { isEmailReady } from "@/lib/email";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { WhatsAppConsentCard } from "@/components/settings/whatsapp-consent-card";
import { WhatsAppStaleQueueCard } from "@/components/settings/whatsapp-stale-queue-card";
import { formatDateTime } from "@/lib/utils";
import { Info } from "lucide-react";

export default async function MessageLogPage() {
  const me = await requireRole(["ADMIN", "ACCOUNTS"]);
  const [waReady, smsReady, emailReady, waMsgs, smsMsgs, emailMsgs, optedOut] = await Promise.all([
    isWhatsAppReady(),
    isSmsReady(),
    isEmailReady(),
    db.whatsAppMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    db.smsMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 }).catch(() => []),
    db.emailMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 }).catch(() => []),
    listOptedOutNumbers(),
  ]);
  const stalePreview = me.role === "ADMIN" ? await previewPendingWhatsApp([]) : null;

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
    ...emailMsgs.map((m) => ({
      id: m.id,
      channel: "Email",
      createdAt: m.createdAt,
      kind: m.kind,
      to: `${m.toName ? `${m.toName} · ` : ""}${m.toEmail}`,
      body: `${m.subject}: ${m.body}`,
      status: m.status,
      error: m.error ?? null,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="space-y-4">
      <PageHeader title="Message Log" description="Every automated WhatsApp, SMS & email message the CRM has sent or queued" />

      {(!waReady || !smsReady || !emailReady) && (
        <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            {!waReady && <>WhatsApp Cloud API not connected. </>}
            {!smsReady && <>SMS gateway not connected. </>}
            {!emailReady && (
              <>Email provider not connected (set EMAIL_API_KEY, EMAIL_ENDPOINT and EMAIL_FROM to enable it — used today only for password/login-ID recovery notifications to the owner). </>
            )}
            Queued messages flush automatically the moment credentials are saved — no code change needed. Failed
            sends are retried by the daily cron. WhatsApp/SMS credentials are saved in{" "}
            <a href="/settings" className="font-medium text-primary hover:underline">Settings → Integrations</a>.
          </p>
        </div>
      )}

      {stalePreview && <WhatsAppStaleQueueCard initial={stalePreview} />}

      <WhatsAppConsentCard optedOut={optedOut} />

      {rows.length === 0 ? (
        <EmptyState title="No messages yet" />
      ) : (
        <>
        {/* Phone: one compact row per message — no sideways scrolling. */}
        <div className="space-y-2 sm:hidden">
        <ul className="divide-y rounded-xl border bg-card">
          {rows.slice(0, 30).map((m) => (
            <li key={`${m.channel}-${m.id}`} className="space-y-0.5 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-semibold">{m.kind.replaceAll("_", " ")} · {m.to}</span>
                <Badge variant={m.status === "SENT" ? "success" : m.status === "FAILED" ? "destructive" : "muted"}>{m.status}</Badge>
              </div>
              <p className="line-clamp-1 text-xs text-muted-foreground" title={m.body}>{m.body}</p>
              <p className="line-clamp-2 text-[11px] text-muted-foreground">{m.channel} · {formatDateTime(m.createdAt)}{m.error ? <span className="text-destructive"> · {m.error}</span> : null}</p>
            </li>
          ))}
        </ul>
        {rows.length > 30 && (
          <details className="rounded-xl border bg-card">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold">Show {rows.length - 30} older messages</summary>
        <ul className="divide-y border-t">
          {rows.slice(30).map((m) => (
            <li key={`${m.channel}-${m.id}`} className="space-y-0.5 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-semibold">{m.kind.replaceAll("_", " ")} · {m.to}</span>
                <Badge variant={m.status === "SENT" ? "success" : m.status === "FAILED" ? "destructive" : "muted"}>{m.status}</Badge>
              </div>
              <p className="line-clamp-1 text-xs text-muted-foreground" title={m.body}>{m.body}</p>
              <p className="line-clamp-2 text-[11px] text-muted-foreground">{m.channel} · {formatDateTime(m.createdAt)}{m.error ? <span className="text-destructive"> · {m.error}</span> : null}</p>
            </li>
          ))}
        </ul>
          </details>
        )}
        </div>
        <div className="max-sm:hidden">
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
        </div>
        </>
      )}
    </div>
  );
}
