import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { CAPI_EVENTS, normalizePhone, sendCapiEvent } from "@/lib/meta-capi";

// Called by the browser right after a public form is submitted (see trackLead in marketing-tags.tsx).
// Adds IP / user-agent / _fbp / _fbc server-side and relays to Meta. Public by design, so it is
// rate-limited and accepts nothing beyond the fields below.
const bodySchema = z.object({
  eventName: z.enum(CAPI_EVENTS),
  eventId: z.string().min(8).max(64),
  mobile: z.string().max(20).optional(),
  email: z.string().max(120).optional(),
  category: z.string().max(80).optional(),
  variant: z.string().max(120).optional(),
  value: z.number().positive().max(10_000_000).optional(),
});

const SOURCE_URL = "https://booking.saharacleaningservices.com/booking";

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`capi:${ip}`, 20, 600).allowed) return NextResponse.json({ ok: false }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  // A real lead always has a valid Indian mobile; without one this public endpoint refuses to relay anything.
  if (!normalizePhone(parsed.data.mobile)) return NextResponse.json({ ok: false }, { status: 400 });

  const referer = request.headers.get("referer");
  const result = await sendCapiEvent({
    ...parsed.data,
    sourceUrl: referer && referer.startsWith("https://") ? referer.slice(0, 500) : SOURCE_URL,
    ip,
    userAgent: request.headers.get("user-agent") ?? undefined,
    fbp: request.cookies.get("_fbp")?.value,
    fbc: request.cookies.get("_fbc")?.value,
  });
  return NextResponse.json({ ok: result.sent });
}
