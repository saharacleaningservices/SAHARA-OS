import { SITE_ORIGIN } from "@/lib/site-origin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { CAPI_EVENTS, normalizePhone, sendCapiEvent } from "@/lib/meta-capi";
import { alreadyRelayed } from "@/lib/meta-event-id";

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
  // Meta browser / click ids passed by the form (attribution store) — same formats Meta's own cookies use.
  fbp: z.string().regex(/^fb\.\d\.\d{10,13}\.\d{4,20}$/).optional(),
  fbc: z.string().regex(/^fb\.\d\.\d{10,13}\.[A-Za-z0-9_-]{6,380}$/).optional(),
});

const SOURCE_URL = `${SITE_ORIGIN}/`;

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`capi:${ip}`, 20, 600).allowed) return NextResponse.json({ ok: false }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  // A real lead always has a valid Indian mobile; without one this public endpoint refuses to relay anything.
  if (!normalizePhone(parsed.data.mobile)) return NextResponse.json({ ok: false }, { status: 400 });

  // The same (event, id) already went to Meta moments ago (retry / double submit): answer ok without sending it twice.
  if (alreadyRelayed(parsed.data.eventName, parsed.data.eventId)) return NextResponse.json({ ok: true, duplicate: true });

  const referer = request.headers.get("referer");
  const { fbp: bodyFbp, fbc: bodyFbc, ...event } = parsed.data;
  const result = await sendCapiEvent({
    ...event,
    sourceUrl: referer && referer.startsWith("https://") ? referer.slice(0, 500) : SOURCE_URL,
    ip,
    userAgent: request.headers.get("user-agent") ?? undefined,
    fbp: bodyFbp ?? request.cookies.get("_fbp")?.value,
    fbc: bodyFbc ?? request.cookies.get("_fbc")?.value,
  });
  return NextResponse.json({ ok: result.sent });
}
