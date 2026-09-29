import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/current-user";
import { getMarketingRoi, listMarketingSpend } from "@/server/marketing-roi";
import { addMarketingSpend } from "@/server/actions/marketing";
import { ACQUISITION_CHANNELS } from "@/lib/attribution";
import { formatINR } from "@/lib/utils";

// Admin-only (inherits the Profit section's ADMIN restriction).
export const dynamic = "force-dynamic";

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const money = (n: number) => (n ? formatINR(n) : "—");
const per = (a: number, b: number) => (a && b ? formatINR(Math.round(a / b)) : "—");

export default async function MarketingRoiPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; view?: string }> }) {
  await requireRole(["ADMIN"]);
  const sp = await searchParams;
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(`${sp.to}T23:59:59`) : undefined;
  const byCampaign = sp.view === "campaign";
  const [rows, spend] = await Promise.all([getMarketingRoi({ from, to, byCampaign }), listMarketingSpend()]);
  const total = rows.reduce(
    (t, r) => ({ spend: t.spend + r.spend, leads: t.leads + r.leads, qualified: t.qualified + r.qualified, bookings: t.bookings + r.bookings, completed: t.completed + r.completed, revenue: t.revenue + r.revenue }),
    { spend: 0, leads: 0, qualified: 0, bookings: 0, completed: 0, revenue: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Marketing ROI" description="Ad spend → lead → qualified → booking → completed job → revenue, by original lead source." />

      <form className="flex flex-wrap items-end gap-2 text-sm">
        <label className="grid gap-1">From<input type="date" name="from" defaultValue={sp.from} className="rounded border px-2 py-1" /></label>
        <label className="grid gap-1">To<input type="date" name="to" defaultValue={sp.to} className="rounded border px-2 py-1" /></label>
        <label className="grid gap-1">View
          <select name="view" defaultValue={sp.view ?? "channel"} className="rounded border px-2 py-1">
            <option value="channel">By source</option>
            <option value="campaign">By campaign</option>
          </select>
        </label>
        <button className="rounded bg-primary px-3 py-1.5 font-semibold text-primary-foreground">Apply</button>
      </form>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                {["Source", byCampaign ? "Campaign" : null, "Spend", "Leads", "Qualified", "Bookings", "Completed", "Revenue", "CPL", "Cost / booking", "Booking rate", "ROAS", "Revenue / lead"]
                  .filter(Boolean)
                  .map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...rows, { channel: "TOTAL", campaign: "", ...total }].map((r) => (
                <tr key={`${r.channel}-${r.campaign}`} className={r.channel === "TOTAL" ? "border-t-2 font-semibold" : "border-t"}>
                  <td className="px-3 py-2">{r.channel}</td>
                  {byCampaign && <td className="px-3 py-2">{r.campaign || "—"}</td>}
                  <td className="px-3 py-2">{money(r.spend)}</td>
                  <td className="px-3 py-2">{r.leads}</td>
                  <td className="px-3 py-2">{r.qualified}</td>
                  <td className="px-3 py-2">{r.bookings}</td>
                  <td className="px-3 py-2">{r.completed}</td>
                  <td className="px-3 py-2">{money(r.revenue)}</td>
                  <td className="px-3 py-2">{per(r.spend, r.leads)}</td>
                  <td className="px-3 py-2">{per(r.spend, r.bookings)}</td>
                  <td className="px-3 py-2">{pct(r.bookings, r.leads)}</td>
                  <td className="px-3 py-2">{r.spend ? `${(r.revenue / r.spend).toFixed(1)}×` : "—"}</td>
                  <td className="px-3 py-2">{per(r.revenue, r.leads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Source = the lead&apos;s original channel (never overwritten). Qualified = moved past NEW. Booking = confirmed / job created. Revenue = value of completed jobs.
        Leads created before 29 Sep 2026 show as &quot;Not tracked (older lead)&quot;.
      </p>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Add ad spend (from the ad platform invoice)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form action={addMarketingSpend} className="grid gap-2 text-sm sm:grid-cols-5">
            <input name="month" type="month" required className="rounded border px-2 py-1" />
            <select name="channel" required className="rounded border px-2 py-1">
              {ACQUISITION_CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input name="campaign" placeholder="Campaign (utm_campaign)" className="rounded border px-2 py-1" />
            <input name="amount" type="number" min="1" step="0.01" required placeholder="Amount ₹" className="rounded border px-2 py-1" />
            <button className="rounded bg-primary px-3 py-1.5 font-semibold text-primary-foreground">Add spend</button>
          </form>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th>Month</th><th>Source</th><th>Campaign</th><th>Amount</th></tr></thead>
            <tbody>
              {spend.map((s) => (
                <tr key={s.id} className="border-t"><td className="py-1">{s.month}</td><td>{s.channel}</td><td>{s.campaign || "—"}</td><td>{formatINR(s.amount)}</td></tr>
              ))}
              {!spend.length && <tr><td colSpan={4} className="py-2 text-muted-foreground">No spend entered yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
