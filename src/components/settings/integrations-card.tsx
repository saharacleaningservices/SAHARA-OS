import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function IntegrationsCard({
  whatsappConfigured,
  mybillbookConfigured,
}: {
  whatsappConfigured: boolean;
  mybillbookConfigured: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
          <div>
            <p className="font-medium text-foreground">WhatsApp Cloud API</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Booking confirmations, team dispatch, reminders, review requests. Set{" "}
              <code>WHATSAPP_ACCESS_TOKEN</code> + <code>WHATSAPP_PHONE_NUMBER_ID</code> on Render (from Meta Business
              Manager) to go live — every message sent while this is unset is queued in the{" "}
              <a href="/admin/whatsapp-log" className="text-primary hover:underline">WhatsApp Log</a> instead, ready
              to send the moment credentials are added.
            </p>
          </div>
          <Badge variant={whatsappConfigured ? "success" : "muted"}>{whatsappConfigured ? "Connected" : "Not connected"}</Badge>
        </div>
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
          <div>
            <p className="font-medium text-foreground">MyBillBook</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Quotations/invoices are generated and stored in Sahara OS regardless. Pushing them to MyBillBook needs
              an API key from MyBillBook support (their API access is plan-specific, not self-serve) — set{" "}
              <code>MYBILLBOOK_API_KEY</code> + <code>MYBILLBOOK_API_BASE_URL</code> once issued.
            </p>
          </div>
          <Badge variant={mybillbookConfigured ? "success" : "muted"}>{mybillbookConfigured ? "Connected" : "Not connected"}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
