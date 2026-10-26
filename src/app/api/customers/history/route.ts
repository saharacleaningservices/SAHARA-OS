import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canSeeCustomerContact, canViewJobAmount, canViewRevenue } from "@/lib/permissions";
import { categoryLabel } from "@/lib/contact-category";
import { jobDateWindowForRole } from "@/server/jobs";
import { normalizeMobile } from "@/server/customer-db";
import { SERVICE_LABELS } from "@/lib/constants";

// Lazy customer history for the slide-over drawer — fetched only when the drawer is opened, never per list row.
// Office roles (ADMIN, ACCOUNTS) look a customer up by mobile or job; Operations (Francis) only by a job inside
// his own Jobs window and never receives the mobile, lifetime value, payments or quotation links.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const role = session.role;
  const office = canSeeCustomerContact(role); // ADMIN, ACCOUNTS
  if (!office && role !== "OPERATIONS") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = request.nextUrl.searchParams;
  const jobId = url.get("jobId");
  let key = normalizeMobile(url.get("mobile"));

  if (jobId) {
    const job = await db.job.findFirst({ where: { id: jobId, deletedAt: null }, select: { customerMobile: true, scheduledDate: true } });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!office) {
      const w = jobDateWindowForRole(role);
      if (w && (job.scheduledDate < w.from || job.scheduledDate > w.to)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    key = normalizeMobile(job.customerMobile);
  } else if (!office) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!key) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const tail = key.slice(-4);
  const same = (m: string | null | undefined) => normalizeMobile(m) === key;
  const showMoney = canViewRevenue(role);
  const showJobAmount = canViewJobAmount(role);

  const [master, jobsRaw, payments] = await Promise.all([
    db.customer.findUnique({ where: { mobile: key }, select: { name: true, contactType: true, outstandingBalance: true, customerNumber: true } }).catch(() => null),
    db.job.findMany({
      where: { customerMobile: { contains: tail }, deletedAt: null },
      orderBy: { scheduledDate: "desc" },
      take: 200,
      select: { id: true, jobNumber: true, customerName: true, customerMobile: true, service: true, serviceVariant: true, packageName: true, scheduledDate: true, teamNumber: true, teamSnapshot: true, status: true, jobValue: true, leadId: true },
    }),
    office
      ? db.payment.findMany({ where: { clientMobile: { contains: tail }, deletedAt: null }, select: { jobId: true, clientMobile: true, paidAmount: true, status: true } })
      : Promise.resolve([]),
  ]);
  const jobs = jobsRaw.filter((j) => same(j.customerMobile));
  const paid = payments.filter((p) => same(p.clientMobile));
  const paidByJob = new Map<string, number>();
  let lifetime = 0;
  for (const p of paid) {
    lifetime += p.paidAmount;
    if (p.jobId) paidByJob.set(p.jobId, (paidByJob.get(p.jobId) ?? 0) + p.paidAmount);
  }

  const leadIds = [...new Set(jobs.map((j) => j.leadId).filter((x): x is string => !!x))];
  const quotes = office && leadIds.length
    ? await db.quotation.findMany({ where: { leadId: { in: leadIds } }, orderBy: { createdAt: "desc" }, select: { id: true, quoteNumber: true, leadId: true } })
    : [];
  const quoteByLead = new Map<string, { id: string; quoteNumber: string }>();
  for (const q of quotes) if (!quoteByLead.has(q.leadId)) quoteByLead.set(q.leadId, q);

  const teamLabel = (j: (typeof jobs)[number]) => {
    try {
      const names = (JSON.parse(j.teamSnapshot ?? "[]") as { name?: string }[]).map((s) => s.name).filter(Boolean);
      if (names.length) return names.join(", ");
    } catch {}
    return j.teamNumber ? `Team ${j.teamNumber}` : null;
  };

  const timeline = jobs.slice(0, 30).map((j) => {
    const q = j.leadId ? quoteByLead.get(j.leadId) : undefined;
    return {
      id: j.id,
      jobNumber: j.jobNumber,
      date: j.scheduledDate.toISOString(),
      service: SERVICE_LABELS[j.service as keyof typeof SERVICE_LABELS] ?? j.service,
      package: j.packageName || j.serviceVariant || null,
      status: j.status,
      team: teamLabel(j),
      ...(showJobAmount ? { jobValue: j.jobValue } : {}),
      ...(showMoney ? { paid: paidByJob.get(j.id) ?? 0 } : {}),
      ...(showMoney && q ? { quotation: { number: q.quoteNumber, href: `/api/quotations/${q.id}/pdf` } } : {}),
    };
  });

  return NextResponse.json(
    {
      name: master?.name || jobs[0]?.customerName || "Customer",
      category: master?.contactType || "CUSTOMER",
      categoryLabel: categoryLabel(master?.contactType),
      customerNumber: master?.customerNumber ?? null,
      bookings: jobs.length,
      ...(office ? { mobile: key } : {}),
      ...(showMoney ? { lifetimeValue: lifetime, outstanding: master?.outstandingBalance ?? 0 } : {}),
      timeline,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
