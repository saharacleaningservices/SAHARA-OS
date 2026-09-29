"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isWhatsAppReady, normalizeNumber, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";
import { HOME_FROM_PRICE } from "@/lib/pricing-master";
import { WHATSAPP_TEST_NUMBERS, getWhatsAppMarketingAudience } from "@/server/whatsapp-audience";

// Admin-only WhatsApp campaigns from the Marketing dashboard. Every message is
// an approved template (never free text), every send is audit-logged, and:
//  • TEST mode sends only to the controlled QA numbers below.
//  • LIVE mode is blocked unless WHATSAPP_CAMPAIGNS=on in Coolify (off by
//    default) and goes only to contacts with a recorded marketing opt-in,
//    never twice to the same number for the same campaign, max 300 per click.




const MAX_PER_SEND = 300;
const FESTIVALS = ["Navratri", "Dussehra", "Diwali"] as const;
const PAGE = "/profit/marketing";

async function requireAdmin() {
  const s = await getSession();
  return s?.role === "ADMIN" ? s : null;
}

async function audit(action: string, summary: string, s: { name: string; email: string }) {
  await db.auditLog
    .create({ data: { entityType: "WhatsAppCampaign", entityId: "marketing", action, summary, actorName: s.name, actorEmail: s.email } })
    .catch(() => {});
}

const campaignSchema = z.object({
  festival: z.enum(FESTIVALS),
  campaign: z.string().regex(/^[a-z0-9_]{3,60}$/, "Campaign name: 3–60 lowercase letters, numbers or _"),
  mode: z.enum(["TEST", "LIVE"]),
});

/** Festival offer (sahara_festival_offer) — test numbers, or the opted-in audience. */
export async function sendFestivalCampaign(values: unknown) {
  const session = await requireAdmin();
  if (!session) return { error: "Only Admin can send campaigns" };
  const parsed = campaignSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid campaign" };
  const { festival, campaign, mode } = parsed.data;
  if (!(await isWhatsAppReady())) return { error: "WhatsApp Cloud API is not connected yet — nothing was sent." };
  const t = templateByName("sahara_festival_offer");
  if (!t) return { error: "Template missing" };

  let recipients: { mobile: string; name: string }[];
  if (mode === "TEST") {
    recipients = WHATSAPP_TEST_NUMBERS.map((mobile) => ({ mobile, name: "Sahara Test" }));
  } else {
    if (process.env.WHATSAPP_CAMPAIGNS !== "on") {
      return { error: "Live campaigns are switched off (WHATSAPP_CAMPAIGNS is not 'on'). Finish QA first, then the owner turns it on in Coolify." };
    }
    const { eligible } = await getWhatsAppMarketingAudience();
    const already = new Set(
      (await db.whatsAppMessage.findMany({ where: { relatedType: "Campaign", relatedId: campaign, direction: "OUTBOUND" }, select: { toNumber: true } })).map((m) =>
        m.toNumber.slice(-10),
      ),
    );
    recipients = eligible.filter((e) => !already.has(e.mobile)).slice(0, MAX_PER_SEND);
    if (!recipients.length) return { error: "No opted-in contacts left to send this campaign to." };
  }

  const price = HOME_FROM_PRICE.toLocaleString("en-IN");
  const landing = `offers?utm_source=whatsapp&utm_medium=marketing&utm_campaign=${campaign}&utm_content=festival_offer`;
  let sent = 0;
  let failed = 0;
  let lastError = "";
  for (const r of recipients) {
    const params = [r.name?.trim().split(/\s+/)[0] || "there", festival, price];
    const res = await sendWhatsAppTemplate({
      kind: "OTHER",
      toNumber: normalizeNumber(r.mobile),
      toName: r.name || null,
      templateName: t.name,
      languageCode: t.language,
      bodyParams: params,
      buttonUrlParams: [{ index: 0, value: landing }],
      preview: renderTemplatePreview(t, params),
      relatedType: "Campaign",
      relatedId: campaign,
    });
    if (res.sent) sent++;
    else {
      failed++;
      lastError = res.error ?? lastError;
    }
  }

  await audit(
    mode === "TEST" ? "WHATSAPP_CAMPAIGN_TEST" : "WHATSAPP_CAMPAIGN_SENT",
    `${campaign} (${festival}) ${mode}: ${sent} sent, ${failed} failed of ${recipients.length}`,
    session,
  );
  revalidatePath(PAGE);
  return { success: true as const, sent, failed, total: recipients.length, lastError };
}

/** The single controlled go-live test: sahara_test_booking to the QA numbers only. */
export async function sendWhatsAppQaTest() {
  const session = await requireAdmin();
  if (!session) return { error: "Only Admin can send the QA test" };
  if (!(await isWhatsAppReady())) return { error: "WhatsApp Cloud API is not connected yet — nothing was sent." };
  const t = templateByName("sahara_test_booking");
  if (!t) return { error: "Template missing" };
  let sent = 0;
  let lastError = "";
  for (const mobile of WHATSAPP_TEST_NUMBERS) {
    const params = ["SAHARA QA TEST"];
    const res = await sendWhatsAppTemplate({
      kind: "OTHER",
      toNumber: normalizeNumber(mobile),
      toName: "Sahara Test",
      templateName: t.name,
      languageCode: t.language,
      bodyParams: params,
      preview: renderTemplatePreview(t, params),
      relatedType: "Campaign",
      relatedId: "qa_test",
    });
    if (res.sent) sent++;
    else lastError = res.error ?? lastError;
  }
  await audit("WHATSAPP_QA_TEST", `QA test to ${WHATSAPP_TEST_NUMBERS.length} test number(s): ${sent} sent`, session);
  revalidatePath(PAGE);
  return sent ? { success: true as const, sent } : { error: lastError || "Not sent" };
}

/** Staff record a customer's explicit WhatsApp marketing consent (e.g. given on a call), with a note. */
export async function recordMarketingConsent(values: unknown) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "ACCOUNTS")) return { error: "Not allowed" };
  const parsed = z
    .object({ leadId: z.string().min(1), consent: z.enum(["OPTED_IN", "OPTED_OUT"]), note: z.string().trim().min(3).max(200) })
    .safeParse(values);
  if (!parsed.success) return { error: "Add a short note on how the customer gave consent" };
  const lead = await db.lead.update({
    where: { id: parsed.data.leadId },
    data: { marketingConsent: parsed.data.consent, marketingConsentAt: new Date() },
    select: { leadNumber: true },
  });
  await db.auditLog
    .create({
      data: {
        entityType: "Lead",
        entityId: parsed.data.leadId,
        action: parsed.data.consent === "OPTED_IN" ? "MARKETING_OPT_IN_RECORDED" : "MARKETING_OPT_OUT_RECORDED",
        summary: `${lead.leadNumber}: ${parsed.data.note}`,
        actorName: session.name,
        actorEmail: session.email,
      },
    })
    .catch(() => {});
  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: true as const };
}
