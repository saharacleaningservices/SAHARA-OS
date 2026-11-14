import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { TrackingSwitch } from "@/components/field-ops/tracking-switch";
import { AutoRefresh } from "@/components/field-ops/auto-refresh";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";
import { canManageTracking, gpsMapScope } from "@/lib/field-ops";
import { getCompanySettings } from "@/server/settings";
import { getLiveLocations } from "@/server/field-ops";
import { getOwnStaffId } from "@/server/jobs";

export const dynamic = "force-dynamic";

const istTime = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const mapHref = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;

// Live staff map (owner 2026-11-14). Super Admin (ADMIN): every staff member's latest location today + the immutable GPS log + the
// tracking switch. Shoaib (ACCOUNTS): only field technicians who are on a live job or checked in for the shift — never the Super Admin
// or any office role; the filter is applied in the query (getLiveLocations). Everyone else is turned away.
export default async function TrackingPage() {
  const user = await requireRole(["ADMIN", "ACCOUNTS"]);
  const scope = gpsMapScope(user.role);
  if (!scope) notFound();
  const isAdmin = canManageTracking(user.role);
  const [settings, live, pings] = await Promise.all([
    getCompanySettings(),
    getLiveLocations({ role: user.role, staffId: await getOwnStaffId(user.sub) }),
    isAdmin ? db.locationPing.findMany({ orderBy: { createdAt: "desc" }, take: 300 }) : Promise.resolve([]),
  ]);
  return (
    <div className="space-y-5">
      <AutoRefresh />
      <PageHeader
        title={isAdmin ? "Live staff map & GPS log" : "Live field staff map"}
        description={
          isAdmin
            ? "Every staff member's latest location today, the append-only GPS log, and the tracking switch. Super Admin only."
            : "Field technicians on an active job or checked in for today's shift. Office staff are never shown."
        }
      />
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="text-sm">Tracking is <b>{settings.gpsTrackingEnabled ? "ON" : "OFF"}</b>. Check-ins at “Reached Location” are always logged; this switch controls the continuous shift pings (every 3 min while a job is On the way / In progress or the person is checked in).</div>
          <TrackingSwitch enabled={settings.gpsTrackingEnabled} />
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Latest location today ({live.length})</h2>
        <div className="w-full overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs"><tr><th className="p-2">Person</th><th className="p-2">Last seen (IST)</th>{isAdmin && <th className="p-2">Role</th>}<th className="p-2">Status</th><th className="p-2">Accuracy</th><th className="p-2">Pings today</th><th className="p-2">Map</th></tr></thead>
            <tbody>
              {live.map((p) => (
                <tr key={p.staffId} className="border-t border-border">
                  <td className="p-2 font-medium">{p.staffName}</td>
                  <td className="p-2">{istTime(p.createdAt)}</td>
                  {isAdmin && <td className="p-2">{p.type === "SUPERVISOR" ? "Office" : "Field"}</td>}
                  <td className="p-2">{p.active ? (p.jobId ? "On a live job" : "Checked in") : "Off shift"}</td>
                  <td className="p-2">{p.accuracyM != null ? `±${p.accuracyM} m` : "—"}</td>
                  <td className="p-2">{p.pings}</td>
                  <td className="p-2"><a className="text-primary underline" target="_blank" rel="noreferrer" href={mapHref(p.lat, p.lng)}>Open map</a></td>
                </tr>
              ))}
              {live.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={isAdmin ? 7 : 6}>No live locations yet today.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">GPS log (latest 300)</h2>
          <div className="w-full overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs"><tr><th className="p-2">Time (IST)</th><th className="p-2">Person</th><th className="p-2">Role</th><th className="p-2">Type</th><th className="p-2">Accuracy</th><th className="p-2">Pin</th></tr></thead>
              <tbody>
                {pings.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-2">{istTime(p.createdAt)}</td>
                    <td className="p-2 font-medium">{p.staffName}</td>
                    <td className="p-2">{p.subjectType === "SUPERVISOR" ? "Office" : "Field"}</td>
                    <td className="p-2">{p.kind === "CHECKIN" ? "Check-in" : "Ping"}</td>
                    <td className="p-2">{p.accuracyM != null ? `±${p.accuracyM} m` : "—"}</td>
                    <td className="p-2"><a className="text-primary underline" target="_blank" rel="noreferrer" href={mapHref(p.lat, p.lng)}>Map</a></td>
                  </tr>
                ))}
                {pings.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={6}>No GPS records yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
