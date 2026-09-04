import { db } from "@/lib/db";

export async function getVehiclesForAssignment() {
  return db.vehicle.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, plateNumber: true, type: true },
  });
}

export async function getAllVehicles() {
  return db.vehicle.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { jobs: true } } } });
}
