// Central notification hub — fans an event out to the right people as:
//   1. a persistent in-app Notification row (unread feed + bell), and
//   2. a Web Push message (loud sound / vibration / tap-to-open on mobile
//      and desktop; the push service also redelivers when a device that was
//      offline comes back online).
//
// Role routing (final production mapping):
//   ADMIN (Altaf)       — every notification; the critical ones use a distinct alert sound
//   OPERATIONS (Shoyab) — Operations Manager: the full stream — CRM (leads,
//                         inquiries, follow-ups, payments) and operations
//                         (crew updates, site visits, bookings)
//   SUPERVISOR (Francis)— Field Coordinator: crew updates, site visits, bookings
//   ACCOUNTS            — CRM: leads, inquiries, follow-ups, payments, bookings

import { db } from "@/lib/db";
import { pushToUsers } from "@/lib/webpush";
import { sendWhatsApp } from "@/lib/whatsapp";

export type NotifKind =
  | "NEW_BOOKING"
  | "NEW_INQUIRY"
  | "PAYMENT_RECEIVED"
  | "FOLLOWUP_DUE"
  | "SITE_VISIT"
  | "CREW_UPDATE"
  | "DEVICE_LOGIN"
  | "PASSWORD_OTP"
  | "APPROVAL_REQUEST"
  | "LOGIN_ATTEMPT";

type Role = "ADMIN" | "OPERATIONS" | "ACCOUNTS" | "SUPERVISOR" | "STAFF";

const KIND_ROLES: Record<NotifKind, Role[]> = {
  NEW_BOOKING: ["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"],
  NEW_INQUIRY: ["ADMIN", "ACCOUNTS", "OPERATIONS"],
  PAYMENT_RECEIVED: ["ADMIN", "ACCOUNTS", "OPERATIONS"],
  FOLLOWUP_DUE: ["ADMIN", "ACCOUNTS", "OPERATIONS"],
  SITE_VISIT: ["ADMIN", "OPERATIONS", "ACCOUNTS", "SUPERVISOR"],
  CREW_UPDATE: ["ADMIN", "OPERATIONS", "SUPERVISOR"],
  DEVICE_LOGIN: ["ADMIN"],
  PASSWORD_OTP: ["ADMIN"],
  APPROVAL_REQUEST: ["ADMIN"],
  LOGIN_ATTEMPT: ["ADMIN"],
};

const CRITICAL_KINDS = new Set<NotifKind>(["DEVICE_LOGIN", "PASSWORD_OTP", "APPROVAL_REQUEST", "LOGIN_ATTEMPT"]);

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
};

/**
 * Never throws — notification delivery must not break the action that fired it.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const roles = KIND_ROLES[input.kind] ?? ["ADMIN"];
    const critical = CRITICAL_KINDS.has(input.kind);

    const recipients = await db.user.findMany({
      where: {
        isActive: true,
        OR: [{ role: { in: roles } }, ...(input.extraUserIds?.length ? [{ id: { in: input.extraUserIds } }] : [])],
      },
      select: { id: true },
    });
    const userIds = [...new Set(recipients.map((r) => r.id))];
    if (userIds.length === 0) return;

    await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        critical,
        meta: input.meta ? JSON.stringify(input.meta) : null,
      })),
    });

    await pushToUsers(userIds, {
      title: input.title,
      body: input.body,
      href: input.href,
      critical,
      tag: input.kind,
    }).catch(() => {});

    if (input.whatsappToAdmin || critical) {
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
  } catch {
    // swallow — see doc comment
  }
}
