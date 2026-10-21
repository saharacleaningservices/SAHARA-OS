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
  if (env.LEADS_SHEET_WEBHOOK_URL && !url.safeParse(env.LEADS_SHEET_WEBHOOK_URL).success) warnings.push("LEADS_SHEET_WEBHOOK_URL is not a valid URL — the Sheet copy stays off.");
  if (prod && !nonEmpty.safeParse(env.BACKUP_ENCRYPTION_KEY).success) warnings.push("BACKUP_ENCRYPTION_KEY is not set — the weekly encrypted backup cannot run.");
  return { errors, warnings };
}
