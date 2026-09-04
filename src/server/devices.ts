import { db } from "@/lib/db";

export async function listPendingDevices() {
  return db.device.findMany({
    where: { status: "PENDING" },
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllDevices() {
  return db.device.findMany({
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { lastSeenAt: "desc" },
    take: 100,
  });
}
