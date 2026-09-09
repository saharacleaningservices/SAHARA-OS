import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Fired by the public booking page when a personalized link is opened. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    await db.bookingLink.updateMany({
      where: { token, openedAt: null },
      data: { openedAt: new Date() },
    });
  } catch {
    // best-effort tracking — never block the booking page
  }
  return NextResponse.json({ ok: true });
}
