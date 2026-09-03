import { db } from "@/lib/db";
import { startOfDay, subDays } from "date-fns";

export async function getStaffForAssignment() {
  return db.staff.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, designation: true, availability: true },
  });
}

export async function getAllStaffForList() {
  const today = startOfDay(new Date());
  const staff = await db.staff.findMany({
    orderBy: { name: "asc" },
    include: {
      attendance: { where: { date: today }, take: 1 },
      jobAssignments: {
        include: { job: true },
        where: { job: { status: { in: ["ASSIGNED", "ON_THE_WAY", "STARTED"] } } },
      },
      _count: { select: { jobAssignments: true } },
    },
  });
  return staff;
}

export async function getStaffDetail(id: string) {
  return db.staff.findUnique({
    where: { id },
    include: {
      attendance: { orderBy: { date: "desc" }, take: 30 },
      jobAssignments: {
        include: { job: true },
        orderBy: { job: { scheduledDate: "desc" } },
        take: 20,
      },
      supervisedJobs: { orderBy: { scheduledDate: "desc" }, take: 10 },
      expenses: { orderBy: { date: "desc" }, take: 10 },
    },
  });
}

export async function getRecentAttendanceSummary() {
  const sevenDaysAgo = startOfDay(subDays(new Date(), 7));
  const attendance = await db.attendance.findMany({
    where: { date: { gte: sevenDaysAgo } },
    include: { staff: { select: { name: true, designation: true } } },
    orderBy: { date: "desc" },
  });
  return attendance;
}
