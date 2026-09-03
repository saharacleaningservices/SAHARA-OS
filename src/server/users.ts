import { db } from "@/lib/db";

export async function getUsersForAssignment() {
  return db.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
}
