import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getResolvedIntegrations } from "@/server/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// WhatsApp Business Profile (owner 2026-10-25): read / update the public address of the connected sender number. Super Admin only.
// The access token never leaves the server. An update is applied ONLY when the connected phone number really is the one the
// caller names (`expectNumber`, digits only) — so a mis-pointed WHATSAPP_PHONE_NUMBER_ID can never edit the wrong profile.

const FIELDS = "about,address,description,email,websites,vertical";
const digits = (s: string) => s.replace(/\D/g, "");

async function connected() {
  const { whatsapp } = await getResolvedIntegrations();
  if (!whatsapp.accessToken || !whatsapp.phoneNumberId) return null;
  return whatsapp;
}

async function displayNumber(w: NonNullable<Awaited<ReturnType<typeof connected>>>) {
  const r = await fetch(`https://graph.facebook.com/${w.apiVersion}/${w.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${w.accessToken}` }, cache: "no-store" }).catch(() => null);
  if (!r?.ok) return null;
  return (await r.json().catch(() => null)) as { display_phone_number?: string; verified_name?: string; quality_rating?: string } | null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const w = await connected();
  if (!w) return NextResponse.json({ error: "WhatsApp is not configured" }, { status: 400 });
  const [num, prof] = await Promise.all([
    displayNumber(w),
    fetch(`https://graph.facebook.com/${w.apiVersion}/${w.phoneNumberId}/whatsapp_business_profile?fields=${FIELDS}`, { headers: { Authorization: `Bearer ${w.accessToken}` }, cache: "no-store" }).catch(() => null),
  ]);
  const json = prof ? ((await prof.json().catch(() => ({}))) as { data?: unknown[]; error?: { message?: string } }) : {};
  if (!prof?.ok) return NextResponse.json({ error: json.error?.message ?? "Could not read the business profile" }, { status: 502 });
  return NextResponse.json({ number: num?.display_phone_number ?? null, verifiedName: num?.verified_name ?? null, profile: json.data?.[0] ?? null });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { address?: string; expectNumber?: string } | null;
  const address = body?.address?.trim();
  if (!address || address.length > 256) return NextResponse.json({ error: "address is required (max 256 characters)" }, { status: 400 });
  if (!body?.expectNumber) return NextResponse.json({ error: "expectNumber is required" }, { status: 400 });
  const w = await connected();
  if (!w) return NextResponse.json({ error: "WhatsApp is not configured" }, { status: 400 });
  const num = await displayNumber(w);
  const shown = digits(num?.display_phone_number ?? "");
  if (!shown || !shown.endsWith(digits(body.expectNumber).slice(-10))) {
    return NextResponse.json({ error: `The connected sender is ${num?.display_phone_number ?? "unknown"}, not the number you named — nothing was changed.` }, { status: 409 });
  }
  const res = await fetch(`https://graph.facebook.com/${w.apiVersion}/${w.phoneNumberId}/whatsapp_business_profile`, {
    method: "POST",
    headers: { Authorization: `Bearer ${w.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", address }),
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: "Could not reach Meta" }, { status: 502 });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
  if (!res.ok || json.success === false) return NextResponse.json({ error: json.error?.message ?? `Meta error ${res.status}` }, { status: 502 });
  return NextResponse.json({ ok: true, number: num?.display_phone_number, address });
}
