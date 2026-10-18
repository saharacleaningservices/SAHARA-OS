import { getCtwaLeadStats } from "@/server/ctwa-stats";
import { formatDate } from "@/lib/utils";

/**
 * Click-to-WhatsApp ads: leads captured automatically from the ad's first WhatsApp message, by ad campaign, plus
 * what is still waiting on the owner (Meta side). Admin-only page; nothing here sends a message.
 */
export async function CtwaLeadsCard({ cloudApiConnected }: { cloudApiConnected: boolean }) {
  const { rows, total, booked } = await getCtwaLeadStats(90);
  const steps: { label: string; state: "done" | "owner" }[] = [
    { label: "Webhook receives WhatsApp messages and the ad's referral details (built — works as soon as an ad runs)", state: "done" },
    { label: "WhatsApp Cloud API connected in Settings → Integrations", state: cloudApiConnected ? "done" : "owner" },
    { label: "Create the Click-to-WhatsApp ad in Meta Ads Manager (needs your Meta ad-account billing / payment method)", state: "owner" },
    { label: "Marketing broadcast templates approved by Meta, then WHATSAPP_CAMPAIGNS=on in Coolify for live sends", state: "owner" },
  ];
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-3 gap-3">
        <div><p className="text-xs text-muted-foreground">Ad leads (90 days)</p><p className="text-lg font-bold">{total}</p></div>
        <div><p className="text-xs text-muted-foreground">Booked</p><p className="text-lg font-bold text-emerald-700">{booked}</p></div>
        <div><p className="text-xs text-muted-foreground">Ads running</p><p className="text-lg font-bold">{rows.length}</p></div>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-muted-foreground">
          No ad leads yet. When a customer taps your Click-to-WhatsApp ad and sends the first message, a lead appears here and in Leads automatically,
          tagged <b>Meta Ads</b> with the ad name — no typing needed.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1 pr-3">Ad / campaign</th><th className="pr-3">Ad ID</th><th className="pr-3 text-right">Leads</th><th className="pr-3 text-right">Booked</th><th>Last lead</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.campaign}-${r.adId}`} className="border-t">
                  <td className="py-1.5 pr-3 font-medium">{r.campaign}</td>
                  <td className="pr-3 text-xs text-muted-foreground">{r.adId ?? "—"}</td>
                  <td className="pr-3 text-right tabular-nums">{r.leads}</td>
                  <td className="pr-3 text-right tabular-nums">{r.booked}</td>
                  <td className="text-xs text-muted-foreground">{formatDate(r.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-2">
            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.state === "done" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
              {s.state === "done" ? "DONE" : "PENDING USER ACTION"}
            </span>
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
