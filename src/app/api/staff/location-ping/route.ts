import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isSameOrigin } from "@/lib/csrf";
import { rateLimit } from "@/lib/rate-limit";
import { validCoords } from "@/lib/geo";
import { getTodayAttendance } from "@/server/attendance";

const RETENTION_DAYS = 30;

const bodySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number().min(0).max(100_000).nullish(),
  jobId: z.string().min(1).nullish(),
});

/**
 * Lightweight live-location log. Called by the Staff App every ~60s while the
 * page is open and the staff member is checked in. Auth is the normal session
 * cookie (this path is NOT in the middleware's public list).
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const staff = await db.staff.findUnique({ where: { userId: session.sub }, select: { id: true } });
  if (!staff) return NextResponse.json({ error: "No staff profile linked to this login" }, { status: 403 });

  // Max 4 pings per minute per staff member (normal cadence is 1/min).
  if (!rateLimit(`loc-ping:${staff.id}`, 4, 60).allowed) {
    return NextResponse.json({ error: "Too many pings" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const coords = parsed.success ? validCoords(parsed.data.lat, parsed.data.lng) : null;
  if (!parsed.success || !coords) return NextResponse.json({ error: "Invalid location" }, { status: 400 });

  // Only track while on shift: checked in today and not yet checked out.
  const today = await getTodayAttendance(staff.id);
  if (!today?.checkInTime || today.checkOutTime) {
    return NextResponse.json({ recorded: false, reason: "not_on_shift" }, { status: 202 });
  }

  let jobId: string | null = null;
  if (parsed.data.jobId) {
    const assigned = await db.jobAssignment.findFirst({ where: { jobId: parsed.data.jobId, staffId: staff.id }, select: { jobId: true } });
    jobId = assigned?.jobId ?? null;
  }

  await db.staffLocationPing.create({
    data: { staffId: staff.id, jobId, lat: coords.lat, lng: coords.lng, accuracy: parsed.data.accuracy ?? null },
  });

  // Cheap retention: ~2% of requests prune pings older than 30 days.
  if (Math.random() < 0.02) {
    await db.staffLocationPing
      .deleteMany({ where: { recordedAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) } } })
      .catch(() => {});
  }

  return NextResponse.json({ recorded: true });
}
