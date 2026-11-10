import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { istDayRange } from "@/lib/ist-days";
import { CONFIRMED_JOB_STATUSES, syncJobCrewAttendance } from "@/server/job-attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Super Admin only. POST { mode: "dry" | "apply", from?: "YYYY-MM-DD", to?: "YYYY-MM-DD" } (India days, inclusive, default today).
 * Runs the job-assignment → attendance rule over confirmed jobs in the range: logs PRESENT for assigned crew who have no
 * attendance row for the job's day. Never overwrites an existing row, refuses closed months. Default is a dry run.
 * Use it to catch up future-dated jobs on their day, or to backfill a range after review.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  let body: { mode?: string; from?: string; to?: string } = {};
  try { body = await request.json(); } catch { /* empty body = today, dry run */ }
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const today = new Date().toISOString().slice(0, 10);
  const from = body.from && re.test(body.from) ? body.from : today;
  const to = body.to && re.test(body.to) ? body.to : from;
  if (to < from) return NextResponse.json({ error: "to is before from" }, { status: 400 });
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 62) return NextResponse.json({ error: "Range too large (max 62 days)" }, { status: 400 });
  const apply = body.mode === "apply";

  const start = istDayRange(`${from}T12:00:00+05:30`).from;
  const end = istDayRange(`${to}T12:00:00+05:30`).to;
  const jobs = await db.job.findMany({
    where: { deletedAt: null, isDemo: false, status: { in: [...CONFIRMED_JOB_STATUSES] }, scheduledDate: { gte: start, lt: end }, assignments: { some: {} } },
    select: { id: true },
    orderBy: { scheduledDate: "asc" },
  });
  const reports = [];
  let marked = 0;
  for (const j of jobs) {
    const r = await syncJobCrewAttendance(j.id, { dryRun: !apply });
    if (r) { marked += r.marked.length; reports.push(r); }
  }
  if (apply) {
    await db.auditLog.create({ data: { entityType: "Attendance", entityId: "job-attendance-sync", action: "JOB_ATTENDANCE_SYNC", summary: `Job→attendance sweep ${from}..${to}: ${marked} day(s) logged over ${reports.length} job(s)`, actorName: session.name } }).catch(() => {});
  }
  return NextResponse.json({ ok: true, mode: apply ? "apply" : "dry", from, to, jobs: reports.length, wouldMarkOrMarked: marked, reports });
}
