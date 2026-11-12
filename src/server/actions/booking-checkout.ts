"use server";

import { campaignOf, classifyTouch, sanitizeTouch } from "@/lib/attribution";
import { sourceTagForChannel } from "@/lib/source-tags";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { currentOtp, otpMatches, signVerified, verifyVerified } from "@/lib/booking-otp-token";
import { CHECKOUT_PLACEHOLDER_NAME } from "@/lib/checkout-capture";
import { SERVICE_CATEGORY_TO_LEGACY } from "@/lib/constants";
import { generateLeadNumber } from "@/lib/id-generators";
import { last10 } from "@/lib/phone";
import { isSmsReady, sendSMS } from "@/lib/sms";
import { normalizeMobile } from "@/server/customer-db";
import { addTimelineEntry } from "@/server/timeline";
import { advanceEnabled } from "@/server/razorpay";
import { finalizeAdvance, startAdvance, type AdvanceResult, type AdvanceStart } from "@/server/booking-advance";

// Server actions behind the website booking flow (owner 2026-11-12): mobile OTP gate, returning-customer lookup, abandoned-checkout
// capture and the 20% advance payment. Safe by default — with no SMS gateway / Razorpay keys configured the flow skips the
// OTP and advance steps and bookings behave exactly as before.
//   BOOKING_OTP_ENABLED=on   turn the OTP gate on (needs the SMS gateway: Settings → Integrations or SMS_API_KEY + SMS_ENDPOINT)
//   OTP_SMS_DLT_TEMPLATE_ID  DLT content-template id registered for the OTP text
//   OTP_SMS_TEXT             optional OTP text with {code}; must match the DLT-registered template
//   BOOKING_ADVANCE_ENABLED  must be "on" to charge the 20% advance (opt-in); RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET in server/razorpay.ts

export type BookingFlowConfig = { otp: boolean; advance: boolean };
export type SavedSite = { id: string; label: string; address: string; pinCode: string; area: string; mapLink: string };
export type VerifiedCustomer = { name: string; sites: SavedSite[] } | null;

async function ip(): Promise<string> {
  try { return clientIp(await headers()); } catch { return "unknown"; }
}
const validMobile = (m: string) => /^[6-9]\d{9}$/.test(m);

export async function getBookingFlowConfig(): Promise<BookingFlowConfig> {
  const otp = (process.env.BOOKING_OTP_ENABLED ?? "").toLowerCase() === "on" && (await isSmsReady().catch(() => false));
  return { otp, advance: advanceEnabled() };
}

export async function sendBookingOtp(mobileRaw: string): Promise<{ ok: true; devCode?: string } | { ok: false; error: string }> {
  const mobile = last10(mobileRaw);
  if (!validMobile(mobile)) return { ok: false, error: "Please enter a valid 10-digit mobile number." };
  if (!(await getBookingFlowConfig()).otp) return { ok: false, error: "OTP verification is not available right now." };
  const from = await ip();
  if (!rateLimit(`bootp:mob:${mobile}`, 3, 600).allowed || !rateLimit(`bootp:ip:${from}`, 10, 600).allowed) return { ok: false, error: "Too many OTP requests — please wait a few minutes." };
  const code = currentOtp(mobile);
  if (!code) return { ok: false, error: "OTP verification is not available right now." };
  const text = (process.env.OTP_SMS_TEXT?.trim() || "{code} is your OTP for Sahara Cleaning Services booking. Valid for 10 minutes. Do not share it with anyone.").replace("{code}", code);
  const r = await sendSMS({ kind: "OTHER", toNumber: mobile, body: text, sensitive: true, dltTemplateId: process.env.OTP_SMS_DLT_TEMPLATE_ID?.trim() || null });
  if (!r.sent) {
    // Local development only: show the code when no gateway answers, so the flow can be tested end to end.
    if (process.env.NODE_ENV !== "production") return { ok: true, devCode: code };
    return { ok: false, error: "We could not send the OTP — please try again or call us." };
  }
  return { ok: true };
}

/** Checks the code and, for a verified returning customer, returns their name and saved addresses (never before verification). */
export async function verifyBookingOtp(mobileRaw: string, codeRaw: string): Promise<{ ok: true; token: string; customer: VerifiedCustomer } | { ok: false; error: string }> {
  const mobile = last10(mobileRaw);
  if (!validMobile(mobile)) return { ok: false, error: "Please enter a valid 10-digit mobile number." };
  if (!rateLimit(`bootp:verify:${mobile}`, 6, 600).allowed) return { ok: false, error: "Too many wrong attempts — please request a new OTP in a few minutes." };
  if (!otpMatches(mobile, codeRaw)) return { ok: false, error: "That OTP is not correct or has expired." };
  const token = signVerified(mobile);
  if (!token) return { ok: false, error: "OTP verification is not available right now." };
  return { ok: true, token, customer: await findCustomer(mobile) };
}

async function findCustomer(mobile: string): Promise<VerifiedCustomer> {
  const key = normalizeMobile(mobile);
  if (!key) return null;
  const c = await db.customer.findUnique({ where: { mobile: key }, select: { id: true, name: true, address: true, area: true } });
  if (!c) return null;
  const sites = await db.customerSite.findMany({ where: { customerId: c.id }, orderBy: { createdAt: "asc" }, take: 8 });
  const saved: SavedSite[] = sites.map((s, n) => ({ id: s.id, label: s.label || `Address ${n + 1}`, address: s.address, pinCode: s.pinCode ?? "", area: s.area ?? "", mapLink: s.mapLink ?? "" }));
  if (saved.length === 0 && c.address) saved.push({ id: "profile", label: "Saved address", address: c.address, pinCode: "", area: c.area ?? "", mapLink: "" });
  return { name: c.name, sites: saved };
}

/**
 * Called right after a successful OTP: logs the verified number in the CRM as an open lead, so a visitor who abandons checkout
 * is still followed up. If the same mobile already has an open lead for this service, that lead is reused. The final booking
 * for the same mobile + service updates this very lead (public-booking-core.ts), so no duplicate is created.
 */
export async function captureCheckoutLead(input: { mobile: string; otpToken?: string; attribution?: unknown; category: string; service: string; packageName?: string; amount?: number; name?: string }): Promise<{ ok: boolean }> {
  const mobile = last10(input.mobile);
  if (!validMobile(mobile)) return { ok: false };
  // Lead-first flow (owner 2026-11-12): the number is saved the moment the visitor taps Continue on step 1. When the OTP gate is on
  // it must be verified first; with the gate off the lead is saved as "not OTP-verified" so staff know to confirm by call.
  const otpOn = (await getBookingFlowConfig()).otp;
  const verified = !!input.otpToken && verifyVerified(input.otpToken, mobile);
  if (otpOn && !verified) return { ok: false };
  const via = verified ? "mobile verified by OTP" : "mobile not OTP-verified";
  try {
    const attr = (input.attribution && typeof input.attribution === "object" ? input.attribution : {}) as Record<string, unknown>;
    const first = sanitizeTouch(attr.first);
    const channel = classifyTouch(first);
    const touchAt = first?.at ? new Date(first.at) : null;
    const attrFields = {
      acquisitionChannel: channel, acquisitionCampaign: campaignOf(first),
      utmSource: first?.source ?? null, utmMedium: first?.medium ?? null, utmCampaign: first?.campaign ?? null, utmTerm: first?.term ?? null, utmContent: first?.content ?? null,
      gclid: first?.gclid ?? null, fbclid: first?.fbclid ?? null, landingPage: first?.landingPage ?? null, landingPageUrl: first?.landingPageUrl ?? null,
      firstTouchSource: first ? channel : null, firstTouchMedium: first?.medium ?? null, firstTouchCampaign: campaignOf(first),
      firstTouchAt: touchAt && !Number.isNaN(touchAt.getTime()) ? touchAt : null,
    };
    const legacy = SERVICE_CATEGORY_TO_LEGACY[input.category] ?? "HOME_DEEP_CLEANING";
    const open = (await db.lead.findMany({
      where: { deletedAt: null, stage: { in: ["NEW", "INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION"] as never }, service: legacy as never, OR: [{ mobile: { endsWith: mobile } }, { whatsapp: { endsWith: mobile } }] },
      orderBy: { createdAt: "desc" },
      take: 5,
    })).find((l) => !l.serviceDate);
    const what = `${input.service}${input.packageName ? ` · ${input.packageName}` : ""}${input.amount ? ` · ₹${Math.round(input.amount).toLocaleString("en-IN")}` : ""}`;
    if (open) {
      await addTimelineEntry({ leadId: open.id, type: "SYSTEM", body: `🛒 Customer started booking (${via}) and is checking out: ${what}` }).catch(() => {});
      return { ok: true };
    }
    const known = await findCustomer(mobile);
    const lead = await db.lead.create({
      data: {
        leadNumber: await generateLeadNumber(),
        name: known?.name || input.name?.trim() || CHECKOUT_PLACEHOLDER_NAME,
        mobile,
        whatsapp: mobile,
        area: known?.sites[0]?.area || "—",
        service: legacy as never,
        serviceCategory: input.category as never,
        serviceVariant: input.service.slice(0, 120),
        packageName: input.packageName?.slice(0, 120) || null,
        source: "WEBSITE" as never,
        notes: `Website booking flow, step 1 lead capture (${via}).`,
        ...attrFields,
        ...(sourceTagForChannel(channel, first?.campaign, first?.medium) ? { sourceTag: sourceTagForChannel(channel, first?.campaign, first?.medium) } : {}), // SRC-GOOGLE-ADS / SRC-META-ADS (owner 2026-11-12)
        formSubmittedAt: new Date(),
      },
    });
    await addTimelineEntry({ leadId: lead.id, type: "SYSTEM", body: `🛒 Website lead captured at step 1 (${via}) while booking ${what}. Call to help complete the booking if it is not confirmed.` }).catch(() => {});
    await db.followUp.create({ data: { leadId: lead.id, dueDate: new Date(Date.now() + 2 * 3600_000), type: "CALL", priority: "MEDIUM", notes: `Abandoned checkout — ${what}. Call if no booking appears.` } }).catch(() => {});
    return { ok: true };
  } catch (e) {
    console.error("[captureCheckoutLead]", e);
    return { ok: false };
  }
}

export async function startAdvanceCheckout(input: { leadId: string; mobile: string }): Promise<AdvanceStart> {
  return startAdvance({ leadId: String(input.leadId ?? "").slice(0, 40), mobile: String(input.mobile ?? "") });
}

export async function confirmAdvancePayment(input: { leadId: string; orderId: string; paymentId: string; signature: string }): Promise<AdvanceResult> {
  const clean = (v: unknown, n: number) => String(v ?? "").slice(0, n);
  return finalizeAdvance({ leadId: clean(input.leadId, 40), orderId: clean(input.orderId, 60), paymentId: clean(input.paymentId, 60), signature: clean(input.signature, 128) });
}
