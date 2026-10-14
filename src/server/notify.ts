// Central notification hub — fans an event out to the right people as:
//   1. a persistent in-app Notification row (unread feed + bell), and
//   2. a Web Push message (loud sound / vibration / tap-to-open on mobile
//      and desktop; the push service also redelivers when a device that was
//      offline comes back online).
//
// Role routing (final production mapping):
//   ADMIN (Altaf)       — every notification; the critical ones use a distinct alert sound
//   ACCOUNTS (Shoyab)   — Accounts & Operations Editor: the full CRM stream —
//                         leads, inquiries, follow-ups, payments, bookings
//   OPERATIONS (Francis)— Operations Manager: CRM (leads, inquiries,
//                         follow-ups) and operations (crew updates, site
//                         visits, bookings) — no payments
//   SUPERVISOR          — Field Coordinator: crew updates, site visits, bookings

import { db } from "@/lib/db";
import { pushToUsers } from "@/lib/webpush";
import { sendWhatsApp } from "@/lib/whatsapp";
import { canSeeCustomerContact } from "@/lib/permissions";

/** Customer numbers are withheld from roles without contact access (owner rule 2026-10-08). */
const maskPhones = (t: string | null | undefined) => (t ? t.replace(/(\+?91[\s-]?)?\b\d{10}\b/g, "(number hidden)") : t);

export type NotifKind =
  | "NEW_BOOKING"
  | "NEW_INQUIRY"
  | "PAYMENT_RECEIVED"
  | "FOLLOWUP_DUE"
  | "STALE_LEAD"
  | "SITE_VISIT"
  | "CREW_UPDATE"
  | "DEVICE_LOGIN"
  | "PASSWORD_OTP"
  | "APPROVAL_REQUEST"
  | "LOGIN_ATTEMPT"
  | "LOGIN_ID_RECOVERY"
  | "STAFF_PIN_RESET"
  | "STAFF_REGISTRATION"
  | "OPS_JOB_CLOSURE"
  | "OPS_PAYMENT_DUE"
  | "OPS_ESCALATION"
  | "OPS_DAILY_SUMMARY"
  | "OPS_QUOTATION_FOLLOWUP"
  | "OPS_FOLLOWUP_DUE"
  | "OPS_EOD_SUMMARY"
  | "OWNER_INQUIRY";

type Role = "ADMIN" | "OPERATIONS" | "ACCOUNTS" | "SUPERVISOR" | "STAFF";

const KIND_ROLES: Record<NotifKind, Role[]> = {
  NEW_BOOKING: ["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"],
  NEW_INQUIRY: ["ADMIN", "ACCOUNTS", "OPERATIONS"],
  PAYMENT_RECEIVED: ["ADMIN", "ACCOUNTS"], // amounts — not Operations (owner rule 2026-10-08)
  FOLLOWUP_DUE: ["ADMIN", "ACCOUNTS", "OPERATIONS"],
  STALE_LEAD: ["ADMIN", "ACCOUNTS", "OPERATIONS"],
  SITE_VISIT: ["ADMIN", "OPERATIONS", "ACCOUNTS", "SUPERVISOR"],
  CREW_UPDATE: ["ADMIN", "OPERATIONS", "SUPERVISOR"],
  DEVICE_LOGIN: ["ADMIN"],
  PASSWORD_OTP: ["ADMIN"],
  APPROVAL_REQUEST: ["ADMIN"],
  LOGIN_ATTEMPT: ["ADMIN"],
  LOGIN_ID_RECOVERY: ["ADMIN"],
  STAFF_PIN_RESET: ["ADMIN", "ACCOUNTS"], // approvable by Super Admin or Accounts (in-app + push only)
  STAFF_REGISTRATION: ["ADMIN", "ACCOUNTS"], // Staff App self-registration awaiting approval
  // Ops reminders (src/server/ops-reminders.ts): Accounts gets the repeats,
  // the Super Admin only the 2-hour escalation + the daily summary.
  OPS_JOB_CLOSURE: ["ACCOUNTS"],
  OPS_PAYMENT_DUE: ["ACCOUNTS"],
  OPS_ESCALATION: ["ADMIN"],
  OPS_DAILY_SUMMARY: ["ADMIN", "ACCOUNTS"],
  OPS_QUOTATION_FOLLOWUP: ["ACCOUNTS"],
  OPS_FOLLOWUP_DUE: ["ACCOUNTS"],
  OPS_EOD_SUMMARY: ["ADMIN", "ACCOUNTS"],
  // Owner Quick Add Inquiry (src/server/owner-inquiry.ts): delivered ONLY to the team members the owner picked
  // (extraUserIds) — no role routing, no WhatsApp copy.
  OWNER_INQUIRY: [],
};

const CRITICAL_KINDS = new Set<NotifKind>(["DEVICE_LOGIN", "PASSWORD_OTP", "APPROVAL_REQUEST", "LOGIN_ATTEMPT", "LOGIN_ID_RECOVERY"]);

export type NotifyInput = {
  kind: NotifKind;
  title: string;
  body?: string;
  href?: string;
  /** extra explicit recipients on top of the role routing */
  extraUserIds?: string[];
  /** also queue a WhatsApp copy to the admin's registered number */
  whatsappToAdmin?: boolean;
  meta?: Record<string, unknown>;
  /** loud alert + stays on screen, without the critical-kind WhatsApp copy */
  critical?: boolean;
  /** push tag — a newer push with the same tag replaces the older one on the device */
  tag?: string;
};

/**
 * Never throws — notification delivery must not break the action that fired it.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const roles = KIND_ROLES[input.kind] ?? ["ADMIN"];
    const critical = CRITICAL_KINDS.has(input.kind) || Boolean(input.critical);

    const recipients = await db.user.findMany({
      where: {
        isActive: true,
        OR: [{ role: { in: roles } }, ...(input.extraUserIds?.length ? [{ id: { in: input.extraUserIds } }] : [])],
      },
      select: { id: true, role: true, notificationsEnabled: true },
    });
    const userIds = [...new Set(recipients.map((r) => r.id))];
    // Ops reminders only: a user who switched notifications off still gets the in-app row
    // (silent, unread — the dashboard keeps showing the unresolved items) but no device push.
    // Security / OTP / approval kinds are never affected by this preference.
    const pushMuted = new Set(input.kind.startsWith("OPS_") ? recipients.filter((r) => !r.notificationsEnabled).map((r) => r.id) : []);
    if (userIds.length === 0) return;
    const restricted = new Set(recipients.filter((r) => !canSeeCustomerContact(r.role)).map((r) => r.id));
    const textFor = (userId: string) =>
      restricted.has(userId) ? { title: maskPhones(input.title) ?? "", body: maskPhones(input.body) ?? null } : { title: input.title, body: input.body ?? null };

    await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        kind: input.kind,
        ...textFor(userId),
        href: input.href ?? null,
        critical,
        meta: input.meta ? JSON.stringify(input.meta) : null,
      })),
    });

    const full = userIds.filter((id) => !restricted.has(id) && !pushMuted.has(id));
    const masked = userIds.filter((id) => restricted.has(id) && !pushMuted.has(id));
    const push = (ids: string[], t: { title: string; body: string | null }) =>
      ids.length ? pushToUsers(ids, { title: t.title, body: t.body ?? undefined, href: input.href, critical, tag: input.tag ?? input.kind }).catch(() => {}) : null;
    // Device push + the admin's WhatsApp copy are network round-trips to push
    // services / Meta — run them in the background so the user's save returns
    // immediately (the in-app notification row above is already saved). The
    // app runs as a long-lived Node server, so these still complete.
    const background = async () => {
      await Promise.all([push(full, { title: input.title, body: input.body ?? null }), push(masked, { title: maskPhones(input.title) ?? "", body: maskPhones(input.body) ?? null })]);
      if (input.whatsappToAdmin || CRITICAL_KINDS.has(input.kind)) {
        const admin = await db.user.findFirst({
          where: { role: "ADMIN", isActive: true },
          orderBy: { createdAt: "asc" },
        });
        if (admin?.phone) {
          await sendWhatsApp({
            kind: "OTHER",
            toNumber: admin.phone,
            toName: admin.name,
            body: `${input.title}${input.body ? `\n${input.body}` : ""}`,
          }).catch(() => {});
        }
      }
    };
    void background().catch(() => {});
  } catch {
    // swallow — see doc comment
  }
}
