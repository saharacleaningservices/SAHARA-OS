import { db } from "@/lib/db";

export type SearchResult = {
  type: "Lead" | "Job" | "Staff" | "Payment" | "Vehicle";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

/** Cross-module search: customer name, mobile, area, service, job/invoice #, staff, vehicle. */
export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [leads, jobs, staff, payments, vehicles] = await Promise.all([
    db.lead.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: q } },
          { mobile: { contains: q } },
          { area: { contains: q } },
          { leadNumber: { contains: q } },
        ],
      },
      take: 6,
      select: { id: true, name: true, mobile: true, area: true, leadNumber: true },
    }),
    db.job.findMany({
      where: {
        deletedAt: null,
        OR: [
          { customerName: { contains: q } },
          { customerMobile: { contains: q } },
          { area: { contains: q } },
          { jobNumber: { contains: q } },
        ],
      },
      take: 6,
      select: { id: true, customerName: true, jobNumber: true, area: true },
    }),
    db.staff.findMany({
      where: { deletedAt: null, OR: [{ name: { contains: q } }, { mobile: { contains: q } }, { employeeCode: { contains: q } }] },
      take: 6,
      select: { id: true, name: true, employeeCode: true, designation: true },
    }),
    db.payment.findMany({
      where: { deletedAt: null, OR: [{ invoiceNumber: { contains: q } }, { clientName: { contains: q } }] },
      take: 6,
      select: { id: true, invoiceNumber: true, clientName: true },
    }),
    db.vehicle.findMany({
      where: { OR: [{ name: { contains: q } }, { plateNumber: { contains: q } }] },
      take: 6,
      select: { id: true, name: true, plateNumber: true },
    }),
  ]);

  return [
    ...leads.map((l) => ({
      type: "Lead" as const,
      id: l.id,
      title: l.name,
      subtitle: `${l.leadNumber} · ${l.mobile} · ${l.area}`,
      href: `/leads/${l.id}`,
    })),
    ...jobs.map((j) => ({
      type: "Job" as const,
      id: j.id,
      title: j.customerName,
      subtitle: `${j.jobNumber} · ${j.area}`,
      href: `/jobs/${j.id}`,
    })),
    ...staff.map((s) => ({
      type: "Staff" as const,
      id: s.id,
      title: s.name,
      subtitle: `${s.employeeCode} · ${s.designation}`,
      href: `/staff/${s.id}`,
    })),
    ...payments.map((p) => ({
      type: "Payment" as const,
      id: p.id,
      title: p.clientName,
      subtitle: p.invoiceNumber,
      href: `/payments`,
    })),
    ...vehicles.map((v) => ({
      type: "Vehicle" as const,
      id: v.id,
      title: v.name,
      subtitle: v.plateNumber,
      href: `/vehicles`,
    })),
  ];
}
