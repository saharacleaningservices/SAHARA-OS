import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { EMPLOYEE_ID_MASTER } from "@/server/employee-id-master";
import { matchJobs, type KhataSiteRow } from "@/lib/khata-job-match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Khatabook parties never assigned by this matcher: non-field books. Ameer / Amir Sheikh re-included by the owner (2026-11-06 23:42 IST).
const NEVER = new Set(["sahara on duty", "shoyab kazi"]);
const IST_MS = 5.5 * 3600 * 1000;
const istDay = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);

/**
 * Super Admin only. POST { mode: "dry" | "apply", rows: [{ khataName, date, desc }] } — Sept/Oct 2026 Khatabook rows.
 * Matches every open Sept–Oct job that has no staff assigned. "apply" adds the staff (JobAssignment) and writes the
 * Khatabook site name into the job notes, only for MATCHED jobs. Idempotent; audit-logged.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  let body: { mode?: string; rows?: KhataSiteRow[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const rows = (Array.isArray(body.rows) ? body.rows : []).filter((r) => r && typeof r.khataName === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && typeof r.desc === "string").slice(0, 5000);
  const apply = body.mode === "apply";

  const from = new Date("2026-09-01T00:00:00+05:30");
  const to = new Date("2026-11-01T00:00:00+05:30");
  const jobs = await db.job.findMany({
    where: { deletedAt: null, isDemo: false, status: { not: "CANCELLED" }, scheduledDate: { gte: from, lt: to }, assignments: { none: {} } },
    select: { id: true, jobNumber: true, scheduledDate: true, area: true, address: true, customerName: true, notes: true },
    orderBy: { scheduledDate: "asc" },
  });
  const staffByKhata = new Map(EMPLOYEE_ID_MASTER.filter((e) => e.staffId && e.khataName).map((e) => [e.khataName!.trim().toLowerCase(), { id: e.staffId!, name: e.name, code: e.code }]));
  const usable = rows.filter((r) => !NEVER.has(r.khataName.trim().toLowerCase()));
  const matches = matchJobs(jobs.map((j) => ({ id: j.id, date: istDay(j.scheduledDate), area: j.area, address: j.address, customerName: j.customerName })), usable);

  const report = [];
  let assigned = 0, jobsUpdated = 0;
  for (const m of matches) {
    const job = jobs.find((j) => j.id === m.jobId)!;
    const staff = m.khataNames.map((k) => staffByKhata.get(k.toLowerCase())).filter(Boolean) as { id: string; name: string; code: string }[];
    const unmapped = m.khataNames.filter((k) => !staffByKhata.has(k.toLowerCase()));
    const status = m.status === "MATCHED" && !staff.length ? "NO_STAFF_RECORD" : m.status;
    report.push({ job: job.jobNumber, date: istDay(job.scheduledDate), area: job.area, customer: job.customerName, status, site: m.site, staff: staff.map((s) => `${s.code} ${s.name}`), unmapped, reason: m.reason });
    if (!apply || status !== "MATCHED") continue;
    for (const s of staff) {
      await db.jobAssignment.upsert({ where: { jobId_staffId: { jobId: job.id, staffId: s.id } }, create: { jobId: job.id, staffId: s.id }, update: {} });
      assigned += 1;
    }
    const line = `Khatabook site: ${m.site} (staff: ${staff.map((s) => s.name).join(", ")}) — matched from Khatabook ${istDay(job.scheduledDate)}`;
    if (!(job.notes ?? "").includes(`Khatabook site: ${m.site}`)) {
      await db.job.update({ where: { id: job.id }, data: { notes: job.notes ? `${job.notes}\n${line}` : line } });
      jobsUpdated += 1;
    }
  }
  const counts = report.reduce<Record<string, number>>((c, r) => ((c[r.status] = (c[r.status] ?? 0) + 1), c), {});
  if (apply) {
    await db.auditLog.create({ data: { entityType: "Job", entityId: "khata-job-match", action: "KHATA_JOB_MATCH", summary: `Khatabook site match: ${jobsUpdated} job(s) noted, ${assigned} staff assignment(s); ${JSON.stringify(counts)}`, actorName: session.name, actorEmail: session.email } }).catch(() => {});
  }
  return NextResponse.json({ mode: apply ? "apply" : "dry", openJobs: jobs.length, counts, assigned, jobsUpdated, report });
}
