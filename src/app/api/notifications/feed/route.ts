import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { canSeeCustomerContact } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poll endpoint for the in-app notification bell (used while a tab is open). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.notification.count({ where: { userId: session.sub, readAt: null } }),
  ]);

  // Older rows may still carry a customer number — withhold it from restricted roles.
  const mask = (t: string | null) => (t && !canSeeCustomerContact(session.role) ? t.replace(/(\+?91[\s-]?)?\b\d{10}\b/g, "(number hidden)") : t);
  return NextResponse.json({
    unreadCount,
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
