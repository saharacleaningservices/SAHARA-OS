import { db } from "@/lib/db";

export async function getAmcList() {
  return db.amcContract.findMany({ where: { deletedAt: null }, orderBy: { nextVisitDate: "asc" } });
}

export async function getAmcDetail(id: string) {
  return db.amcContract.findFirst({
    where: { id, deletedAt: null },
    include: { visits: { orderBy: { visitDate: "desc" } } },
  });
}
