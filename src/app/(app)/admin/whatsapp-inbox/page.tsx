import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { SectionTabs, WHATSAPP_TABS } from "@/components/shared/section-tabs";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";
import { findLeadForNumber, isWhatsAppReady, normalizeNumber } from "@/lib/whatsapp";
import { CLOUD_TEMPLATES } from "@/lib/whatsapp-cloud-templates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { WhatsAppComposer } from "@/components/whatsapp/whatsapp-composer";
import { ConversationModeToggle } from "@/components/whatsapp/conversation-mode-toggle";
import { formatDateTime, cn } from "@/lib/utils";
import { Info } from "lucide-react";

// WhatsApp Inbox for the API-only +91 9175220270 sender: staff read customer
// replies and answer them here (free-form inside the 24h service window,
// approved templates outside it). Nothing is sent without a staff click.

export const dynamic = "force-dynamic";

function ticks(m: { direction: string; status: string; deliveredAt: Date | null; readAt: Date | null }) {
  if (m.direction === "INBOUND") return null;
  if (m.status === "FAILED") return <span className="text-destructive">failed</span>;
  if (m.status === "CANCELLED") return <span>cancelled</span>;
  if (m.status === "QUEUED") return <span>queued</span>;
  if (m.readAt) return <span className="text-sky-600">✓✓ read</span>;
  if (m.deliveredAt) return <span>✓✓ delivered</span>;
  return <span>✓ sent</span>;
}

export default async function WhatsAppInboxPage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const { n } = await searchParams;
  const selected = n ? normalizeNumber(n) : null;

  const [ready, recent] = await Promise.all([
    isWhatsAppReady(),
    db.whatsAppMessage.findMany({
      where: { status: { not: "CANCELLED" }, kind: { notIn: ["DEVICE_APPROVAL", "ATTENDANCE_SUMMARY", "DAILY_SUMMARY", "MONTHLY_SUMMARY"] } },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { toNumber: true, toName: true, body: true, direction: true, createdAt: true },
    }),
  ]);

  // One row per customer number, newest activity first.
  const conversations = new Map<string, (typeof recent)[number] & { unreadInbound: boolean }>();
  for (const m of recent) {
    if (!conversations.has(m.toNumber)) conversations.set(m.toNumber, { ...m, unreadInbound: m.direction === "INBOUND" });
  }
  const list = [...conversations.values()].slice(0, 60);

  const thread = selected
    ? await db.whatsAppMessage.findMany({ where: { toNumber: selected }, orderBy: { createdAt: "asc" }, take: 300 })
    : [];
  const lead = selected ? await findLeadForNumber(selected) : null;
  const conv = selected ? await db.whatsAppConversation.findUnique({ where: { number: selected } }) : null;
  const lastInbound = [...thread].reverse().find((m) => m.direction === "INBOUND");
  const windowOpen = Boolean(lastInbound && Date.now() - lastInbound.createdAt.getTime() < 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-4">
      <PageHeader title="WhatsApp Inbox" description="Customer conversations on the Sahara WhatsApp Cloud API number" />
      <SectionTabs tabs={WHATSAPP_TABS} active="/admin/whatsapp-inbox" />

      {!ready && (
        <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>WhatsApp Cloud API not connected — conversations are view-only and nothing can be sent.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="max-h-[75vh] overflow-y-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Conversations</CardTitle>
            <form action="/admin/whatsapp-inbox" className="flex gap-2 pt-2">
              <input name="n" placeholder="Open a number…" className="h-8 w-full rounded-md border bg-background px-2 text-sm" inputMode="tel" />
              <button className="h-8 rounded-md border px-3 text-xs font-medium">Open</button>
            </form>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {list.length === 0 && <p className="p-2 text-xs text-muted-foreground">No conversations yet.</p>}
            {list.map((c) => (
              <Link
                key={c.toNumber}
                href={`/admin/whatsapp-inbox?n=${c.toNumber}`}
                className={cn("block rounded-md p-2 text-sm hover:bg-muted", selected === c.toNumber && "bg-muted")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{c.toName || `+${c.toNumber}`}</span>
                  {c.unreadInbound && <span className="size-2 shrink-0 rounded-full bg-primary" title="Customer wrote last" />}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {c.direction === "INBOUND" ? "↘ " : "↗ "}
                  {c.body}
                </p>
                <p className="text-[10px] text-muted-foreground">{formatDateTime(c.createdAt)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        {!selected ? (
          <EmptyState title="Select a conversation" />
        ) : (
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">{lead?.name || thread.at(-1)?.toName || `+${selected}`}</CardTitle>
                <p className="text-xs text-muted-foreground">+{selected}</p>
              </div>
              {lead ? (
                <div className="text-right text-xs">
                  <Link href={`/leads/${lead.id}`} className="font-semibold text-primary hover:underline">
                    {lead.leadNumber}
                  </Link>
                  <p className="text-muted-foreground">
                    {lead.service.replaceAll("_", " ")} · {lead.stage}
                    {lead.acquisitionCampaign ? ` · ${lead.acquisitionCampaign}` : ""}
                  </p>
                </div>
              ) : (
                <Badge variant="muted">No lead yet</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-md bg-muted/40 p-3">
                {thread.length === 0 && <p className="text-xs text-muted-foreground">No messages with this number yet.</p>}
                {thread.map((m) => (
                  <div key={m.id} className={cn("flex", m.direction === "INBOUND" ? "justify-start" : "justify-end")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm",
                        m.direction === "INBOUND" ? "bg-background" : "bg-emerald-50 dark:bg-emerald-950",
                        m.status === "CANCELLED" && "opacity-50",
                      )}
                    >
                      {m.direction !== "INBOUND" && m.sentByName && <p className="mb-0.5 text-[10px] font-semibold text-muted-foreground">{m.sentByName}</p>}
                      {m.templateName && <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Template · {m.templateName}</p>}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className="mt-1 flex justify-end gap-2 text-[10px] text-muted-foreground">
                        <span>{formatDateTime(m.createdAt)}</span>
                        {ticks(m)}
                      </p>
                      {m.errorMessage && m.status === "FAILED" && <p className="text-[10px] text-destructive">{m.errorMessage}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <ConversationModeToggle number={selected} mode={conv?.mode === "AI" ? "AI" : "HUMAN"} changedBy={conv?.changedByName} />
              <WhatsAppComposer
                number={selected}
                ready={ready}
                windowOpen={windowOpen}
                templates={CLOUD_TEMPLATES.map((t) => ({ name: t.name, category: t.category, purpose: t.purpose, body: t.body }))}
                defaultName={lead?.name ?? ""}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
