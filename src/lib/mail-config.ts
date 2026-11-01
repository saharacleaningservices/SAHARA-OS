// Outbound e-mail identity + Hostinger SMTP settings (2026-11-01). Pure helpers — no network, safe to unit-test.
//
// Every message leaves as  "SAHARA Cleaning Services <contact@saharacleaningservices.com>"  — the sender is a constant, not an
// env var, so no setting can turn customer mail into mail from a staff alias. shoyab@ / francis@ are free Hostinger aliases of
// the same mailbox: they receive customer replies (Reply-To is never rewritten) but are never used as the sending identity.

export const MAIL_FROM_NAME = "SAHARA Cleaning Services";
export const MAIL_FROM_ADDRESS = "contact@saharacleaningservices.com";
export const MAIL_FROM = `${MAIL_FROM_NAME} <${MAIL_FROM_ADDRESS}>`;

/** Super-Admin-only backup address for server-down / hosting alerts. Override with ADMIN_ALERT_EMAIL. */
export const DEFAULT_ADMIN_ALERT_EMAIL = "sheikhaltaf161@gmail.com";

export const STAFF_ALIASES = ["shoyab@saharacleaningservices.com", "francis@saharacleaningservices.com"] as const;

export type SmtpSettings = { host: string; port: number; secure: boolean; auth: { user: string; pass: string } };

/** Hostinger SMTP: smtp.hostinger.com, port 465, implicit TLS. Returns null until SMTP_USER and SMTP_PASS are set. */
export function smtpSettings(env: Record<string, string | undefined> = process.env): SmtpSettings | null {
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  if (!user || !pass) return null;
  const port = Number(env.SMTP_PORT) || 465;
  return { host: env.SMTP_HOST?.trim() || "smtp.hostinger.com", port, secure: port === 465, auth: { user, pass } };
}

export const adminAlertEmail = (env: Record<string, string | undefined> = process.env) => (env.ADMIN_ALERT_EMAIL?.trim() || DEFAULT_ADMIN_ALERT_EMAIL).toLowerCase();
