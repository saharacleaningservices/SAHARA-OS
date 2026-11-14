import { MapPin } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill, type PillTone } from "@/components/shared/status-pill";
import { AutoRefresh } from "@/components/field-ops/auto-refresh";
import { requireRole } from "@/lib/current-user";
import { canViewJobAmount } from "@/lib/permissions";
import { OfficeActions } from "@/components/field-ops/office-actions";
import { getOwnStaffId } from "@/server/jobs";
import { getFieldOps } from "@/server/field-ops";
import { canManageTracking, canOfficeClose, cashWithStaffLabel, COLLECT_MODE_LABELS, FIELD_STAGE_LABELS, type CollectMode, type FieldStage } from "@/lib/field-ops";
import { SERVICE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const STAGES: FieldStage[] = ["ASSIGNED", "REACHED", "IN_PROGRESS", "COMPLETED"];
const STAGE_TONE: Record<FieldStage, PillTone> = { ASSIGNED: "muted", REACHED: "info", IN_PROGRESS: "warn", COMPLETED: "good" };
const ist = (d: Date | null) => (d ? d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "—");

// Live Field Ops (owner brief 2026-11-13): every active job's stage Assigned → Reached (GPS Verified) → In Progress (OTP Verified) →
// Completed (₹ Collected), with IST timestamps, GPS map link, start-OTP backup.
export default async function FieldOpsPage() {
  const user = await requireRole(["ADMIN", "OPERATIONS", "SUPERVISOR", "ACCOUNTS"]);
  const showMoney = canViewJobAmount(user.role);
  const rows = await getFieldOps({ role: user.role, staffId: await getOwnStaffId(user.sub) });
  const canClose = canOfficeClose(user.role);
  const cashRows = rows.filter((r) => r.cashWithStaff);
  const alerts = rows.filter((r) => r.gpsFlag || r.collectedMode === "PENDING_APPROVAL");

  return (
    <div className="space-y-5">
      <AutoRefresh />
      <PageHeader title="Live Field Ops" description={`${rows.length} jobs today or still in the field · refreshes every 30 s`} />

      {canManageTracking(user.role) && <a href="/field-ops/tracking" className="inline-block rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-primary">Live GPS log &amp; tracking settings →</a>}

      {cashRows.length > 0 && (
        <div className="space-y-1">
          {cashRows.map((r) => (
            <div key={r.id} className="rounded-2xl border-2 border-red-600 bg-red-50 p-3 text-base font-extrabold text-red-800 dark:bg-red-500/10 dark:text-red-200">
              {cashWithStaffLabel(r.cashWithStaff!.name, r.cashWithStaff!.amount)} <span className="ml-2 text-xs font-semibold">{r.jobNumber} · collected {ist(r.cashWithStaff!.at)} IST</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAGES.map((s) => (
          <div key={s} className="rounded-2xl border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">{FIELD_STAGE_LABELS[s]}</div>
            <div className="text-2xl font-extrabold">{rows.filter((r) => r.stage === s).length}</div>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <b>{alerts.length} need attention:</b> {alerts.map((r) => `${r.jobNumber}${r.gpsFlag === "OUT_OF_ZONE" ? " [OUT-OF-ZONE GPS]" : r.gpsFlag === "NO_PIN" ? " [NO MAP PIN]" : ""}${r.collectedMode === "PENDING_APPROVAL" ? " [PAYMENT PENDING APPROVAL]" : ""}`).join(" · ")}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No jobs in the field right now.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/jobs/${r.id}`} className="font-mono text-sm font-bold text-primary">{r.jobNumber}</a>
                <StatusPill tone={STAGE_TONE[r.stage]}>{FIELD_STAGE_LABELS[r.stage]}{r.stage === "COMPLETED" && r.collectedAmount != null && showMoney ? ` · ₹${r.collectedAmount.toLocaleString("en-IN")}` : ""}</StatusPill>
                {r.gpsFlag === "OUT_OF_ZONE" && <StatusPill tone="bad">[OUT-OF-ZONE GPS] {r.reachedDistanceM != null ? `${(r.reachedDistanceM / 1000).toFixed(1)} km` : ""}</StatusPill>}
                {r.gpsFlag === "NO_PIN" && <StatusPill tone="orange">GPS unverified — no map pin</StatusPill>}
                {r.collectedMode === "PENDING_APPROVAL" && <StatusPill tone="bad">Payment pending approval</StatusPill>}
              </div>
              <div className="mt-1 text-sm">{r.customerName} · {SERVICE_LABELS[r.service] ?? r.service} · {r.area} · {r.scheduledTime}</div>
              <div className="text-xs text-muted-foreground">Team: {r.team.length ? r.team.map((m) => `${m.name}${m.isLead ? " ★" : ""}`).join(", ") : "not assigned"}</div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Reached (IST)</dt><dd className="font-semibold">{ist(r.reachedAt)}{r.reachedAccuracyM != null ? ` · ±${r.reachedAccuracyM} m` : ""}</dd></div>
                <div><dt className="text-muted-foreground">OTP verified</dt><dd className="font-semibold">{ist(r.otpVerifiedAt)}</dd></div>
                <div><dt className="text-muted-foreground">Started / Completed</dt><dd className="font-semibold">{ist(r.startedAt)} / {ist(r.completedAt)}</dd></div>
                <div><dt className="text-muted-foreground">GPS</dt><dd className="font-semibold">{!r.gpsVisible ? "Restricted" : r.mapHref ? <a className="text-primary underline" href={r.mapHref} target="_blank" rel="noreferrer"><MapPin className="mr-0.5 inline size-3" />Open map</a> : "—"}</dd></div>
              </dl>

              {r.startOtp && (
                <div className="mt-2 rounded-xl bg-muted px-3 py-2 text-xs">
                  Customer start code (backup): <b className="font-mono text-base tracking-widest">{r.startOtp}</b>
                  {r.startOtpAttempts >= 5 && <span className="ml-2 font-semibold text-red-700">· locked after 5 wrong tries</span>}
                </div>
              )}
              {showMoney && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Billed ₹{r.billed.toLocaleString("en-IN")}
                  {r.collectedMode && <> · Collected {r.collectedAmount != null ? `₹${r.collectedAmount.toLocaleString("en-IN")}` : "—"} via {COLLECT_MODE_LABELS[r.collectedMode as CollectMode] ?? r.collectedMode}</>}
                  {r.pendingReason && <> · Reason: {r.pendingReason}</>}
                </div>
              )}
              {canClose && (r.needsClosure || r.cashWithStaff) && (
                <OfficeActions isAdmin={user.role === "ADMIN"} jobId={r.id} balance={r.collectedMode === "PENDING_APPROVAL" || r.collectedAmount == null ? r.billed : 0} closable={r.needsClosure} cashWithStaff={Boolean(r.cashWithStaff)} />
              )}
              {r.cashSettledAt && <div className="mt-1 text-xs text-muted-foreground">Cash received by {r.cashSettledByName} · {ist(r.cashSettledAt)} IST</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
