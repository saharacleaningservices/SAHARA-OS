"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isWhatsAppReady, normalizeNumber, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";
import { HOME_FROM_PRICE } from "@/lib/pricing-master";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { getLivePricing } from "@/server/pricing";
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

  // "Starts from" must be what a customer actually pays on festival dates: the lowest festival Premium
  // price of THIS festival window (not the regular price). Falls back to the regular master price only
  // if the window has no Premium festival price set.
  const live = await getLivePricing();
  const offer = live.festivals.find((f) => f.name.toLowerCase() === festival.toLowerCase());
  const festivalPremium = offer ? ["SCS-01", "SCS-02", "SCS-03"].map((id) => offer.prices[id]).filter((n): n is number => typeof n === "number") : [];
  const price = (festivalPremium.length ? Math.min(...festivalPremium) : HOME_FROM_PRICE).toLocaleString("en-IN");
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

// ── CSV / Excel broadcast (owner request 2026-10-10) ─────────────────────────
// Upload a contact list → preview counts → paced send (50–100/min) of an
// approved MARKETING template. The upload never grants consent: only uploaded
// numbers that ALREADY have a recorded marketing opt-in in Sahara OS (and no
// STOP) are messaged; every other number is reported as excluded. TEST mode
// sends only to the approved QA number(s), whatever the file contains.

// Only templates Meta shows as Active for 9175220270 (festival offer + customer reactivation
// verified Active in WhatsApp Manager 2026-10-10).
const BROADCAST_TEMPLATES = ["sahara_festival_offer", "sahara_customer_reactivation", "sahara_diwali_festival_offer"] as const;
const contactSchema = z.object({ mobile: z.string().max(30), name: z.string().max(80).optional().default(""), service: z.string().max(60).optional().default("") });
const broadcastSchema = z.object({
  campaign: z.string().regex(/^[a-z0-9_]{3,60}$/, "Campaign name: 3–60 lowercase letters, numbers or _"),
  template: z.enum(BROADCAST_TEMPLATES),
  festival: z.enum(FESTIVALS).optional(),
  mode: z.enum(["TEST", "LIVE"]),
  perMinute: z.coerce.number().min(50).max(100),
  contacts: z.array(contactSchema).max(5000),
});

/** Splits an uploaded list into who may be messaged (recorded opt-in, no STOP) and why the rest are excluded. */
async function classifyContacts(contacts: z.infer<typeof contactSchema>[]) {
  const { eligible } = await getWhatsAppMarketingAudience();
  const optedIn = new Map(eligible.map((e) => [e.mobile, e.name]));
  const optedOut = new Set(
    (await db.whatsAppConsent.findMany({ where: { optedOut: true }, select: { phoneNumber: true } })).map((r) => r.phoneNumber.replace(/\D/g, "").slice(-10)),
  );
  const seen = new Set<string>();
  const ok: { mobile: string; name: string; service: string }[] = [];
  let invalid = 0, duplicates = 0, stopped = 0, noConsent = 0;
  for (const c of contacts) {
    const m = c.mobile.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(m)) { invalid++; continue; }
    if (seen.has(m)) { duplicates++; continue; }
    seen.add(m);
    if (optedOut.has(m)) { stopped++; continue; }
    if (!optedIn.has(m)) { noConsent++; continue; }
    ok.push({ mobile: m, name: (c.name || optedIn.get(m) || "").trim(), service: c.service.trim() });
  }
  return { ok, counts: { uploaded: contacts.length, invalid, duplicates, stopped, noConsent, eligible: ok.length } };
}

export async function previewBroadcast(contacts: unknown) {
  const session = await requireAdmin();
  if (!session) return { error: "Only Admin can prepare broadcasts" };
  const parsed = z.array(contactSchema).max(5000).safeParse(contacts);
  if (!parsed.success) return { error: "The file has more than 5,000 rows or unreadable values." };
  const { counts } = await classifyContacts(parsed.data);
  return { success: true as const, counts, liveEnabled: process.env.WHATSAPP_CAMPAIGNS === "on" };
}

async function festivalStartPrice(festival: string) {
  const live = await getLivePricing();
  const offer = live.festivals.find((f) => f.name.toLowerCase() === festival.toLowerCase());
  const prem = offer ? ["SCS-01", "SCS-02", "SCS-03"].map((id) => offer.prices[id]).filter((n): n is number => typeof n === "number") : [];
  return (prem.length ? Math.min(...prem) : HOME_FROM_PRICE).toLocaleString("en-IN");
}

export async function startBroadcast(values: unknown) {
  const session = await requireAdmin();
  if (!session) return { error: "Only Admin can send broadcasts" };
  const parsed = broadcastSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid broadcast" };
  const { campaign, template, festival, mode, perMinute, contacts } = parsed.data;
  if (template === "sahara_festival_offer" && !festival) return { error: "Pick the festival for the festival offer template." };
  if (!(await isWhatsAppReady())) return { error: "WhatsApp Cloud API is not connected yet — nothing was sent." };
  const { getBroadcastJob, startBroadcastJob } = await import("@/server/whatsapp-broadcast");
  if (getBroadcastJob()?.status === "RUNNING") return { error: "A broadcast is already running — wait for it to finish or stop it first." };

  let list: { mobile: string; name: string; service: string }[];
  if (mode === "TEST") {
    list = WHATSAPP_TEST_NUMBERS.map((mobile) => ({ mobile, name: "Sahara Test", service: "" }));
  } else {
    if (process.env.WHATSAPP_CAMPAIGNS !== "on") {
      return { error: "Live campaigns are switched off (WHATSAPP_CAMPAIGNS is not 'on'). Finish QA first, then the owner turns it on in Coolify." };
    }
    list = (await classifyContacts(contacts)).ok;
    if (!list.length) return { error: "None of the uploaded numbers has a recorded WhatsApp marketing opt-in — nothing to send." };
  }

  const price = template === "sahara_festival_offer" ? await festivalStartPrice(festival!) : "";
  const utm = (page: string) => `${page}?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=${campaign}`;
  const recipients = list.map((r) => {
    const first = r.name.split(/\s+/)[0] || "there";
    if (template === "sahara_festival_offer") return { mobile: r.mobile, name: r.name, params: [first, festival!, price], buttonParam: utm("offers") };
    // Rich Diwali template: image header + one name variable; the button lands on the festival page.
    if (template === "sahara_diwali_festival_offer") return { mobile: r.mobile, name: r.name, params: [first], buttonParam: utm("offers"), headerImageUrl: `${PUBLIC_BOOKING_URL}/marketing/diwali-offer-banner.jpg` };
    return { mobile: r.mobile, name: r.name, params: [first, r.service || "home deep cleaning"], buttonParam: utm("home-deep-cleaning-pune") };
  });
  const started = startBroadcastJob({ campaign, templateName: template, perMinute, recipients, startedBy: session.name });
  if (!started) return { error: "Could not start the broadcast (another one is running or the template is missing)." };
  await audit(mode === "TEST" ? "WHATSAPP_BROADCAST_TEST" : "WHATSAPP_BROADCAST_STARTED", `${campaign} (${template}) ${mode}: ${recipients.length} recipient(s) at ${perMinute}/min`, session);
  revalidatePath(PAGE);
  return { success: true as const, total: recipients.length, perMinute };
}

export async function broadcastStatus() {
  if (!(await requireAdmin())) return null;
  const { getBroadcastJob } = await import("@/server/whatsapp-broadcast");
  return getBroadcastJob();
}

export async function stopBroadcast() {
  const session = await requireAdmin();
  if (!session) return { error: "Only Admin can stop broadcasts" };
  const { stopBroadcastJob } = await import("@/server/whatsapp-broadcast");
  stopBroadcastJob();
  await audit("WHATSAPP_BROADCAST_STOPPED", "Broadcast stop requested", session);
  return { success: true as const };
}
