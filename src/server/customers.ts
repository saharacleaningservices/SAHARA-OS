import { db } from "@/lib/db";

/** One row per distinct mobile number across Leads, Jobs and Payments. */
export async function getCustomersList() {
  const [leads, jobs, payments] = await Promise.all([
    db.lead.findMany({
      where: { deletedAt: null },
      select: { mobile: true, name: true, createdAt: true },
    }),
    db.job.findMany({
      where: { deletedAt: null },
      select: { customerMobile: true, customerName: true, jobValue: true, createdAt: true },
    }),
    db.payment.findMany({
      where: { deletedAt: null, status: "PAID" },
      select: { clientMobile: true, paidAmount: true },
    }),
  ]);

  const byMobile = new Map<
    string,
    { mobile: string; name: string; leadCount: number; jobCount: number; revenue: number; lastActivity: Date }
  >();

  function touch(mobile: string | null, name: string, at: Date) {
    if (!mobile) return;
    const existing = byMobile.get(mobile);
    if (!existing) {
      byMobile.set(mobile, { mobile, name, leadCount: 0, jobCount: 0, revenue: 0, lastActivity: at });
    } else if (at > existing.lastActivity) {
      existing.lastActivity = at;
      existing.name = name || existing.name;
    }
  }

  for (const l of leads) {
    touch(l.mobile, l.name, l.createdAt);
    const row = byMobile.get(l.mobile);
    if (row) row.leadCount += 1;
  }
  for (const j of jobs) {
    touch(j.customerMobile, j.customerName, j.createdAt);
    const row = byMobile.get(j.customerMobile);
    if (row) row.jobCount += 1;
  }
  for (const p of payments) {
    if (!p.clientMobile) continue;
    const row = byMobile.get(p.clientMobile);
    if (row) row.revenue += p.paidAmount;
  }

  return Array.from(byMobile.values()).sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
}

/** Every lead, job, payment, photo and review tied to a mobile number — the
 * permanent customer history ("never lose history"). */
export async function getCustomerHistory(mobile: string) {
  const [leads, jobs, payments, reviews] = await Promise.all([
    db.lead.findMany({
      where: { mobile, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { timeline: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } } },
    }),
    db.job.findMany({
      where: { customerMobile: mobile, deletedAt: null },
      orderBy: { scheduledDate: "desc" },
      include: { photos: { orderBy: { uploadedAt: "desc" } } },
    }),
    db.payment.findMany({ where: { clientMobile: mobile, deletedAt: null }, orderBy: { dueDate: "desc" } }),
    db.review.findMany({ where: { customerMobile: mobile }, orderBy: { createdAt: "desc" } }),
  ]);

  return { leads, jobs, payments, reviews };
}
