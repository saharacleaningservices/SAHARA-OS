import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { TrackingSwitch } from "@/components/field-ops/tracking-switch";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/server/settings";

export const dynamic = "force-dynamic";

// Super Admin only: the immutable live-GPS log for every field technician and both supervisors, plus the tracking switch.
export default async function TrackingPage() {
  const user = await requireRole(["ADMIN"]);
  if (user.role !== "ADMIN") notFound();
  const [settings, pings] = await Promise.all([
    getCompanySettings(),
    db.locationPing.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title="Live GPS log" description="Append-only record of check-ins and active-shift pings. Visible to the Super Admin only." />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="text-sm">Tracking is <b>{settings.gpsTrackingEnabled ? "ON" : "OFF"}</b>. Check-ins at “Reached Location” are always logged; this switch controls the periodic pings.</div>
        <TrackingSwitch enabled={settings.gpsTrackingEnabled} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs"><tr><th className="p-2">Time (IST)</th><th className="p-2">Person</th><th className="p-2">Role</th><th className="p-2">Type</th><th className="p-2">Accuracy</th><th className="p-2">Pin</th></tr></thead>
          <tbody>
            {pings.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-2">{p.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="p-2 font-medium">{p.staffName}</td>
                <td className="p-2">{p.subjectType === "SUPERVISOR" ? "Supervisor" : "Field"}</td>
                <td className="p-2">{p.kind === "CHECKIN" ? "Check-in" : "Ping"}</td>
                <td className="p-2">{p.accuracyM != null ? `±${p.accuracyM} m` : "—"}</td>
                <td className="p-2"><a className="text-primary underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${p.lat.toFixed(5)},${p.lng.toFixed(5)}`}>Map</a></td>
              </tr>
            ))}
            {pings.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={6}>No GPS records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
