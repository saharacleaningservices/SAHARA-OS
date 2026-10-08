import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getResolvedIntegrations } from "@/server/integrations";
import { WHATSAPP_TRANSACTIONAL_TEMPLATES, whatsappOutboundMode } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only: approval status of the WhatsApp templates on Sahara's WABA, so the
 * owner can see which are APPROVED before switching outbound mode. Super Admin
 * only. Returns names / status / category — never the token or any secret.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { whatsapp } = await getResolvedIntegrations();
  if (!whatsapp.accessToken || !whatsapp.businessId) {
    return NextResponse.json({ error: "WhatsApp Business Account ID or access token not configured" }, { status: 400 });
  }
  const res = await fetch(
    `https://graph.facebook.com/${whatsapp.apiVersion}/${whatsapp.businessId}/message_templates?fields=name,status,category,language&limit=100`,
    { headers: { Authorization: `Bearer ${whatsapp.accessToken}` }, cache: "no-store" },
  ).catch(() => null);
  if (!res) return NextResponse.json({ error: "Could not reach Meta" }, { status: 502 });
  const json = (await res.json().catch(() => ({}))) as { data?: { name: string; status: string; category: string; language: string }[]; error?: { message?: string } };
  if (!res.ok) return NextResponse.json({ error: json.error?.message ?? `Meta error ${res.status}` }, { status: 502 });

  const templates = (json.data ?? []).map((t) => ({ name: t.name, status: t.status, category: t.category, language: t.language }));
  return NextResponse.json({
    outboundMode: whatsappOutboundMode(),
    templates,
    transactionalAllowList: WHATSAPP_TRANSACTIONAL_TEMPLATES.map((name) => ({
      name,
      status: templates.find((t) => t.name === name)?.status ?? "NOT FOUND",
    })),
  });
}
