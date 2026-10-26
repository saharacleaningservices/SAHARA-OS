// Startup environment check (called by scripts/render-start.mjs before anything else runs).
//   ERRORS stop the boot with a clear message — only for things the app cannot work without in production.
//   WARNINGS are logged and never stop the boot (an optional integration missing, or a value that looks weak), so a
//   deploy can never be taken down by a variable that merely improves things. Values are never printed.
import { z } from "zod";

const url = z.string().url();
const nonEmpty = z.string().min(1);

export function checkEnv(env = process.env) {
  const errors = [];
  const warnings = [];
  const prod = env.NODE_ENV === "production";

  if (prod) {
    if (!nonEmpty.safeParse(env.AUTH_SECRET).success) errors.push("AUTH_SECRET is not set — sessions cannot be signed. Set it in Coolify.");
    else if (env.AUTH_SECRET.length < 32) warnings.push("AUTH_SECRET is shorter than 32 characters — rotate it to a longer random value when convenient.");
    const dbUrl = env.DATABASE_URL ?? "";
    if (!dbUrl) warnings.push("DATABASE_URL is not set — the app falls back to ./dev.db inside the container, which is wiped on every redeploy. Point it at the persistent volume (for example file:/data/dev.db).");
    else if (!dbUrl.startsWith("file:")) errors.push("DATABASE_URL must be a file: URL (SQLite) pointing at the persistent volume, for example file:/data/dev.db.");
    else if (!dbUrl.startsWith("file:/")) warnings.push("DATABASE_URL is a relative path — it is wiped on every redeploy unless it points at the persistent volume.");
  }

  // Integrations: warn only. Group = variables that must be set together to work.
  const groups = [
    ["WhatsApp Cloud API", ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"]],
    ["Meta Conversions API", ["NEXT_PUBLIC_META_PIXEL_ID", "META_CAPI_TOKEN"]],
    ["Lead Google Sheet copy", ["LEADS_SHEET_WEBHOOK_URL", "LEADS_SHEET_WEBHOOK_SECRET"]],
    ["Automation (cron) token", ["CRON_TOKEN"]],
  ];
  for (const [name, keys] of groups) {
    const set = keys.filter((k) => nonEmpty.safeParse(env[k]).success);
    if (set.length && set.length < keys.length) warnings.push(`${name}: only ${set.length} of ${keys.length} variables are set (${keys.filter((k) => !set.includes(k)).join(", ")} missing) — the feature stays off.`);
  }
  // WhatsApp bot readiness (owner 2026-10-26): once the Cloud API credentials exist, say plainly what still stops customers
  // receiving messages or the chatbot hearing replies. Warnings only — a deploy is never blocked by these.
  if (nonEmpty.safeParse(env.WHATSAPP_ACCESS_TOKEN).success && nonEmpty.safeParse(env.WHATSAPP_PHONE_NUMBER_ID).success) {
    const mode = String(env.WHATSAPP_OUTBOUND_MODE ?? "").toLowerCase();
    if (!["test", "transactional", "live"].includes(mode)) warnings.push("WhatsApp: WHATSAPP_OUTBOUND_MODE is unset or not test / transactional / live — it behaves as TEST, so only the owner's test numbers receive messages. Set transactional (booking and job messages) or live (also campaigns).");
    else if (mode === "test") warnings.push("WhatsApp: WHATSAPP_OUTBOUND_MODE=test — real customers receive nothing. Set transactional (booking and job messages) or live (also campaigns) when ready.");
    if (!nonEmpty.safeParse(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN).success) warnings.push("WhatsApp: WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set — Meta cannot verify the webhook, so delivery status and customer replies will not arrive.");
    if (prod && !nonEmpty.safeParse(env.WHATSAPP_APP_SECRET).success) warnings.push("WhatsApp: WHATSAPP_APP_SECRET is not set — in production the inbound webhook rejects every unsigned call, so replies, button taps and delivery status are ignored.");
    if (env.WHATSAPP_USE_TEMPLATES !== "on") warnings.push("WhatsApp: WHATSAPP_USE_TEMPLATES is not 'on' — approved templates (booking confirmed, job completed, reviews) are not used; plain-text fallbacks go out instead.");
    else if (!["v1", "v2", "v3"].includes(String(env.WHATSAPP_COMPLETED_TEMPLATE ?? ""))) warnings.push("WhatsApp: WHATSAPP_COMPLETED_TEMPLATE is unset — set v3 once sahara_job_completed_v3 is approved so 'Rate Us on Google' opens the review funnel.");
    if (env.WHATSAPP_AUTO_REPLIES !== "on") warnings.push("WhatsApp: WHATSAPP_AUTO_REPLIES is not 'on' — the chatbot menu and lead auto-replies are off.");
  }
  if (env.CALL_AUTOREPLY === "on" && !nonEmpty.safeParse(env.CALL_TRIGGER_TOKEN || env.MISSED_CALL_TOKEN || env.CRON_TOKEN).success) warnings.push("Call auto-reply: CALL_AUTOREPLY=on but no CALL_TRIGGER_TOKEN is set — the call webhook rejects every request.");
  if (env.LEADS_SHEET_WEBHOOK_URL && !url.safeParse(env.LEADS_SHEET_WEBHOOK_URL).success) warnings.push("LEADS_SHEET_WEBHOOK_URL is not a valid URL — the Sheet copy stays off.");
  if (prod && !nonEmpty.safeParse(env.BACKUP_ENCRYPTION_KEY).success) warnings.push("BACKUP_ENCRYPTION_KEY is not set — the weekly encrypted backup cannot run.");
  return { errors, warnings };
}
