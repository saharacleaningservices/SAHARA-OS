import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { canSeeCustomerContact } from "@/lib/permissions";
import { maybeSweepUncontactedLeads } from "@/server/lead-response";
import { KIND_TO_NAV_HREF } from "@/lib/nav-badge-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poll endpoint for the in-app notification bell (used while a tab is open). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Uncontacted-lead (15 min) alert: throttled, indexed, fire-and-forget — see src/server/lead-response.ts.
  if (session.role === "ADMIN" || session.role === "ACCOUNTS") maybeSweepUncontactedLeads();

  const [items, unreadCount, ops, me, unreadByKind] = await Promise.all([
    db.notification.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.notification.count({ where: { userId: session.sub, readAt: null } }),
    db.opsReminderSettings.findUnique({ where: { id: "default" }, select: { soundEnabled: true } }),
    db.user.findUnique({ where: { id: session.sub }, select: { soundEnabled: true, notificationsEnabled: true } }),
    // Sidebar badges: one grouped count over the (userId, readAt) index — rides on this existing poll.
    db.notification.groupBy({ by: ["kind"], where: { userId: session.sub, readAt: null }, _count: { _all: true } }),
  ]);
  const badges: Record<string, number> = {};
  for (const g of unreadByKind) {
    const href = KIND_TO_NAV_HREF[g.kind];
    if (href) badges[href] = (badges[href] ?? 0) + g._count._all;
  }

  // Older rows may still carry a customer number — withhold it from restricted roles.
  const mask = (t: string | null) => (t && !canSeeCustomerContact(session.role) ? t.replace(/(\+?91[\s-]?)?\b\d{10}\b/g, "(number hidden)") : t);
  return NextResponse.json({
    // Build id baked into this server bundle; open tabs compare it with their own and reload when it differs.
    build: process.env.NEXT_PUBLIC_BUILD_ID ?? null,
    unreadCount,
    badges,
    // Reminder sound = global switch AND this user's own switch; notifications = this user's own switch.
    opsSound: (ops?.soundEnabled ?? true) && (me?.soundEnabled ?? true),
    opsNotifications: me?.notificationsEnabled ?? true,
    userSound: me?.soundEnabled ?? true,
    canConfigure: session.role === "ADMIN" || session.role === "ACCOUNTS",
    items: items.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: mask(n.title) ?? "",
      body: mask(n.body),
      href: n.href,
      critical: n.critical,
      read: n.readAt != null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}
