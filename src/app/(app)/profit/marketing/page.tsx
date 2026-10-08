import { ResponsiveFold } from "@/components/shared/responsive-fold";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/current-user";
import { getMarketingRoi, getWhatsAppCampaignStats, listKnownCampaigns, listMarketingSpend, NOT_TRACKED } from "@/server/marketing-roi";
import { addMarketingSpend } from "@/server/actions/marketing";
import { ACQUISITION_CHANNELS } from "@/lib/attribution";
import { LEAD_STAGE_LABELS, SERVICE_LABELS } from "@/lib/constants";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { isWhatsAppReady } from "@/lib/whatsapp";
import { getWhatsAppMarketingAudience, WHATSAPP_TEST_NUMBERS } from "@/server/whatsapp-audience";
import { WhatsAppCampaignPanel } from "@/components/marketing/whatsapp-campaign-panel";
import { formatINR } from "@/lib/utils";

// Admin-only (inherits the Profit section's ADMIN restriction). The central
// marketing dashboard: every source (Google Ads, Meta Ads, Google Business
// Profile, WhatsApp, festival campaigns, organic, direct) → lead → interested
// → quotation → booking → completed → revenue, with spend and ROI.
export const dynamic = "force-dynamic";

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const money = (n: number) => (n ? formatINR(n) : "—");
const per = (a: number, b: number) => (a && b ? formatINR(Math.round(a / b)) : "—");

type SP = { from?: string; to?: string; view?: string; channel?: string; campaign?: string; service?: string; stage?: string; festival?: string };

const BOOK = PUBLIC_BOOKING_URL;
const TRACKING_LINKS: { use: string; where: string; value: string }[] = [
  { use: "Google Ads — final URL", where: "Ad → Final URL", value: `${BOOK}/booking` },
  { use: "Google Ads — tracking", where: "Campaign settings → Final URL suffix (auto-tagging ON adds gclid)", value: "utm_source=google&utm_medium=cpc&utm_campaign=<campaign_name>" },
  { use: "Meta Ads — website URL", where: "Ad → Website URL", value: `${BOOK}/booking` },
  { use: "Meta Ads — tracking", where: "Ad → URL parameters", value: "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}" },
  { use: "Google Business Profile — website", where: "GBP → Edit profile → Website", value: `${BOOK}/booking?utm_source=gbp&utm_medium=organic&utm_campaign=gbp_profile` },
  { use: "Google Business Profile — booking/posts", where: "GBP → Bookings link / Offer posts", value: `${BOOK}/offers?utm_source=gbp&utm_medium=organic&utm_campaign=sahara_festival_2026` },
  { use: "Festival — Meta ad", where: "Ad → Website URL", value: `${BOOK}/offers` },
  { use: "WhatsApp status / share link", where: "WhatsApp status, broadcast text", value: `${BOOK}/offers?utm_source=whatsapp&utm_medium=marketing&utm_campaign=sahara_festival_2026` },
  { use: "Instagram bio", where: "Instagram → Edit profile → Links", value: `${BOOK}/booking?utm_source=instagram&utm_medium=social&utm_campaign=ig_bio` },
  { use: "Facebook Page button", where: "Page → Book Now button", value: `${BOOK}/booking?utm_source=facebook&utm_medium=social&utm_campaign=fb_page` },
];

export default async function MarketingDashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole(["ADMIN"]);
  const sp = await searchParams;
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(`${sp.to}T23:59:59`) : undefined;
  const byCampaign = sp.view === "campaign";
  const filters = { from, to, byCampaign, channel: sp.channel || undefined, campaign: sp.campaign || undefined, service: sp.service || undefined, stage: sp.stage || undefined, festivalOnly: sp.festival === "1" };

  const [rows, spend, campaigns, waStats, audience, connected] = await Promise.all([
    getMarketingRoi(filters),
    listMarketingSpend(),
    listKnownCampaigns(),
    getWhatsAppCampaignStats({ from, to }),
    getWhatsAppMarketingAudience(),
    isWhatsAppReady(),
  ]);
  const total = rows.reduce(
    (t, r) => ({ spend: t.spend + r.spend, leads: t.leads + r.leads, qualified: t.qualified + r.qualified, quoted: t.quoted + r.quoted, bookings: t.bookings + r.bookings, completed: t.completed + r.completed, revenue: t.revenue + r.revenue }),
    { spend: 0, leads: 0, qualified: 0, quoted: 0, bookings: 0, completed: 0, revenue: 0 },
  );
  const tags = [
    { name: "Google Analytics 4", ok: !!process.env.NEXT_PUBLIC_GA4_ID, env: "NEXT_PUBLIC_GA4_ID" },
    { name: "Google Ads tag", ok: !!process.env.NEXT_PUBLIC_GOOGLE_ADS_ID, env: "NEXT_PUBLIC_GOOGLE_ADS_ID" },
    { name: "Google Ads lead conversion", ok: !!process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL, env: "NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL" },
    { name: "Meta Pixel", ok: !!process.env.NEXT_PUBLIC_META_PIXEL_ID, env: "NEXT_PUBLIC_META_PIXEL_ID" },
    { name: "Meta domain verification", ok: !!process.env.META_DOMAIN_VERIFICATION, env: "META_DOMAIN_VERIFICATION" },
    { name: "WhatsApp Cloud API", ok: connected, env: "CRM → Settings → Integrations" },
  ];
  const funnel = [
    { label: "Leads", value: total.leads, sub: "" },
    { label: "Interested", value: total.qualified, sub: pct(total.qualified, total.leads) },
    { label: "Quotation", value: total.quoted, sub: pct(total.quoted, total.leads) },
    { label: "Booked", value: total.bookings, sub: pct(total.bookings, total.leads) },
    { label: "Completed", value: total.completed, sub: pct(total.completed, total.leads) },
    { label: "Revenue", value: money(total.revenue), sub: total.spend ? `ROAS ${(total.revenue / total.spend).toFixed(1)}×` : "" },
    { label: "Ad spend", value: money(total.spend), sub: total.bookings ? `${per(total.spend, total.bookings)} / booking` : "" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Marketing Dashboard" description="Every source and campaign → lead → interested → quotation → booking → completed → revenue, with ad spend and ROI." />

      <form className="flex flex-wrap items-end gap-2 text-sm">
        <label className="grid gap-1">From<input type="date" name="from" defaultValue={sp.from} className="rounded border px-2 py-1" /></label>
        <label className="grid gap-1">To<input type="date" name="to" defaultValue={sp.to} className="rounded border px-2 py-1" /></label>
        <label className="grid gap-1">Source
          <select name="channel" defaultValue={sp.channel ?? ""} className="rounded border px-2 py-1">
            <option value="">All sources</option>
            {[...ACQUISITION_CHANNELS, NOT_TRACKED].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="grid gap-1">Campaign
          <select name="campaign" defaultValue={sp.campaign ?? ""} className="rounded border px-2 py-1">
            <option value="">All campaigns</option>
            {campaigns.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="grid gap-1">Service
          <select name="service" defaultValue={sp.service ?? ""} className="rounded border px-2 py-1">
            <option value="">All services</option>
            {Object.entries(SERVICE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="grid gap-1">Status
          <select name="stage" defaultValue={sp.stage ?? ""} className="rounded border px-2 py-1">
            <option value="">All statuses</option>
            {Object.entries(LEAD_STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="grid gap-1">View
          <select name="view" defaultValue={sp.view ?? "channel"} className="rounded border px-2 py-1">
            <option value="channel">By source</option>
            <option value="campaign">By campaign</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 pb-1.5"><input type="checkbox" name="festival" value="1" defaultChecked={sp.festival === "1"} /> Festival only</label>
        <button className="rounded bg-primary px-3 py-1.5 font-semibold text-primary-foreground">Apply</button>
      </form>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
        {funnel.map((f) => (
          <Card key={f.label} className="gap-0 py-0">
            <CardContent className="p-2 sm:p-3">
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="text-xl font-bold">{f.value}</p>
              {f.sub && <p className="text-xs text-muted-foreground">{f.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <ResponsiveFold title="Sources & campaigns" hint="leads → bookings → revenue · ROI">
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                {["Source", byCampaign ? "Campaign" : null, "Spend", "Leads", "Interested", "Quotation", "Bookings", "Completed", "Revenue", "CPL", "Cost / booking", "Booking rate", "ROAS"]
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
                  <td className="px-3 py-2">{r.quoted}</td>
                  <td className="px-3 py-2">{r.bookings}</td>
                  <td className="px-3 py-2">{r.completed}</td>
                  <td className="px-3 py-2">{money(r.revenue)}</td>
                  <td className="px-3 py-2">{per(r.spend, r.leads)}</td>
                  <td className="px-3 py-2">{per(r.spend, r.bookings)}</td>
                  <td className="px-3 py-2">{pct(r.bookings, r.leads)}</td>
                  <td className="px-3 py-2">{r.spend ? `${(r.revenue / r.spend).toFixed(1)}×` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Source = the lead&apos;s original channel (never overwritten; website leads from UTM tags / gclid, office-entered leads from the Marketing channel field).
        Interested = moved past New. Quotation = quoted or later. Booking = confirmed / job created. Revenue = value of completed jobs. One open enquiry per mobile —
        repeat enquiries update the existing lead. Leads created before 29 Sep 2026 show as &quot;{NOT_TRACKED}&quot;.
      </p>
      </ResponsiveFold>

      <ResponsiveFold title="WhatsApp marketing (9175220270)">
      <Card className="gap-0 border-0 py-0 shadow-none">
        <CardContent className="px-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Existing contacts</p><p className="text-lg font-bold">{audience.totalContacts}</p></div>
            <div><p className="text-xs text-muted-foreground">Opted in (can receive offers)</p><p className="text-lg font-bold text-emerald-700">{audience.optIn}</p></div>
            <div><p className="text-xs text-muted-foreground">Consent unknown (need opt-in first)</p><p className="text-lg font-bold">{audience.unknown}</p></div>
            <div><p className="text-xs text-muted-foreground">Opted out (never messaged)</p><p className="text-lg font-bold">{audience.optOut}</p></div>
          </div>
          <WhatsAppCampaignPanel connected={connected} liveEnabled={process.env.WHATSAPP_CAMPAIGNS === "on"} eligible={audience.optIn} testNumbers={WHATSAPP_TEST_NUMBERS} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>{["Campaign / template", "Sent", "Delivered", "Read", "Failed", "Replied", "Leads", "Bookings", "Revenue", "Booking rate"].map((h) => <th key={h} className="py-1 pr-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {waStats.map((r) => (
                  <tr key={r.campaign} className="border-t">
                    <td className="py-1 pr-3">{r.campaign}</td>
                    <td className="pr-3">{r.sent}</td>
                    <td className="pr-3">{r.delivered}</td>
                    <td className="pr-3">{r.read}</td>
                    <td className="pr-3">{r.failed}</td>
                    <td className="pr-3">{r.replied}</td>
                    <td className="pr-3">{r.leads}</td>
                    <td className="pr-3">{r.bookings}</td>
                    <td className="pr-3">{money(r.revenue)}</td>
                    <td className="pr-3">{pct(r.bookings, r.sent)}</td>
                  </tr>
                ))}
                {!waStats.length && <tr><td colSpan={10} className="py-2 text-muted-foreground">No template messages sent yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </ResponsiveFold>

      <ResponsiveFold title="Tracking setup — Google Ads, Meta Ads, Google Business Profile">
      <Card className="gap-0 border-0 py-0 shadow-none">
        <CardContent className="px-0 space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t.name} title={t.env} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {t.name}: {t.ok ? "connected" : "not set"}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-3">Use</th><th className="pr-3">Where to paste</th><th>Value</th></tr></thead>
              <tbody>
                {TRACKING_LINKS.map((l) => (
                  <tr key={l.use} className="border-t align-top">
                    <td className="py-1 pr-3 font-medium">{l.use}</td>
                    <td className="py-1 pr-3 text-muted-foreground">{l.where}</td>
                    <td className="py-1"><code className="break-all text-xs">{l.value}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Name campaigns in lowercase with underscores (e.g. <code>sahara_festival_2026</code>, <code>google_home_cleaning_pune</code>) and use the same name when adding
            spend below, so leads, bookings, revenue and spend line up per campaign.
          </p>
        </CardContent>
      </Card>
      </ResponsiveFold>

      <ResponsiveFold title="Add ad spend (from the ad platform invoice)">
      <Card className="gap-0 border-0 py-0 shadow-none">
        <CardContent className="px-0 space-y-4">
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
      </ResponsiveFold>
    </div>
  );
}
