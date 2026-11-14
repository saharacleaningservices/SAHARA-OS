import { PageHeader } from "@/components/shared/page-header";
import { SectionTabs, WHATSAPP_TABS } from "@/components/shared/section-tabs";
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
import { MetaTemplateSubmitCard } from "@/components/settings/meta-template-submit-card";
import { SUBMITTABLE_TEMPLATES } from "@/lib/meta-template-payload";
import { BOOKING_OTP_TEMPLATE_NAME, BOOKING_OTP_TEMPLATE_VARIABLES, renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";

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
      // Delivery receipts from the Meta webhook (the same data the Inbox ticks use).
      status: m.readAt ? "READ" : m.deliveredAt ? "DELIVERED" : m.status,
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
      <SectionTabs tabs={WHATSAPP_TABS} active="/admin/whatsapp-log" />

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
      {me.role === "ADMIN" && <MetaTemplateSubmitCard names={SUBMITTABLE_TEMPLATES} />}
      {me.role === "ADMIN" && (() => {
        const t = templateByName(BOOKING_OTP_TEMPLATE_NAME);
        if (!t) return null;
        const live = process.env.WHATSAPP_USE_TEMPLATES === "on" && ["otp2", "otp1"].includes(process.env.WHATSAPP_BOOKING_TEMPLATE ?? "");
        return (
          <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Booking confirmation + Service Start Code (Meta template v2)</h2>
              <Badge variant={live ? "success" : "muted"}>{live ? "In use" : "Not switched on: customers get the plain-text version with the same code"}</Badge>
            </div>
            <p>Sent when the office taps <b>Confirm Booking</b>. Submit exactly this in Meta WhatsApp Manager (or use the submit card below), then set <code>WHATSAPP_USE_TEMPLATES=on</code> and <code>WHATSAPP_BOOKING_TEMPLATE=otp2</code> in Coolify once Meta shows it as Approved.</p>
            <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Template name</dt><dd><code className="font-mono">{t.name}</code></dd>
              <dt className="text-muted-foreground">Language code</dt><dd><code className="font-mono">{t.language}</code> (English)</dd>
              <dt className="text-muted-foreground">Category</dt><dd>{t.category}</dd>
              <dt className="text-muted-foreground">Body</dt><dd><pre className="whitespace-pre-wrap font-sans">{t.body}</pre></dd>
              <dt className="text-muted-foreground">Footer</dt><dd>{t.footer}</dd>
              <dt className="text-muted-foreground">Button</dt><dd>URL “View Booking” → <code className="break-all">{t.buttons?.[0] && "url" in t.buttons[0] ? t.buttons[0].url : ""}</code></dd>
              <dt className="text-muted-foreground">Variables</dt>
              <dd><ol className="space-y-0.5">{BOOKING_OTP_TEMPLATE_VARIABLES.map((v, i) => <li key={v}><code className="font-mono">{`{{${i + 1}}}`}</code> = {v} <span className="text-muted-foreground">(e.g. {t.examples[i]})</span></li>)}</ol></dd>
              <dt className="text-muted-foreground">Preview</dt><dd><pre className="whitespace-pre-wrap font-sans text-muted-foreground">{renderTemplatePreview(t, t.examples)}</pre></dd>
            </dl>
          </div>
        );
      })()}


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
                <Badge variant={["SENT", "DELIVERED", "READ"].includes(m.status) ? "success" : m.status === "FAILED" ? "destructive" : "muted"}>{m.status}</Badge>
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
                <Badge variant={["SENT", "DELIVERED", "READ"].includes(m.status) ? "success" : m.status === "FAILED" ? "destructive" : "muted"}>{m.status}</Badge>
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
                  <Badge variant={["SENT", "DELIVERED", "READ"].includes(m.status) ? "success" : m.status === "FAILED" ? "destructive" : "muted"}>
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
