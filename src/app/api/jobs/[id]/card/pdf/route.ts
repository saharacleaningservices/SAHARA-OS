import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { startOfDay, endOfDay } from "date-fns";
import { getSession } from "@/lib/session";
import { getJobDetail, canAccessJob, getOwnStaffId } from "@/server/jobs";
import { getCompanySettings } from "@/server/settings";
import { JobCardDocument } from "@/lib/pdf/job-card-document";
import { maskJobCardForAudience } from "@/lib/pdf/job-card-mask";
import { resolveBrandLogoDataUrl } from "@/lib/pdf/file-to-data-url";
import { SERVICE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { canSeeCustomerContact, canViewJobAmount } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const job = await getJobDetail(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const ownStaffId = await getOwnStaffId(session.sub);
  if (!canAccessJob(session, job, ownStaffId)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  // Francis (SUPERVISOR) final policy, 2026-09-21: the Job Card is a
  // TODAY-ONLY operational action for him — canAccessJob alone allows
  // today+tomorrow, so add the stricter same-day check here specifically.
  if (session.role === "SUPERVISOR" && (job.scheduledDate < startOfDay(new Date()) || job.scheduledDate > endOfDay(new Date()))) {
    return new NextResponse("Job Card is only available for today's jobs", { status: 403 });
  }

  const settings = await getCompanySettings();
  const logoDataUrl = await resolveBrandLogoDataUrl(settings.logoUrl);

  const advance = job.payments.reduce((s, p) => s + (p.paidAmount ?? 0), 0);
  const balance = Math.max(job.jobValue - advance, 0);
  const paymentStatus =
    balance <= 0 && advance > 0 ? "Paid" : advance > 0 ? "Partly Paid" : "Pending";

  // Field crew always get the team copy (no customer phone / payment figures).
  // Operations too (owner rule 2026-10-08): no customer phone / job amounts.
  const fieldRole = !canSeeCustomerContact(session.role) || !canViewJobAmount(session.role);
  const audience: "team" | "office" =
    fieldRole || _request.nextUrl.searchParams.get("team") === "1" ? "team" : "office";

  const buffer = await renderToBuffer(
    JobCardDocument(maskJobCardForAudience({
      jobNumber: job.jobNumber,
      logoDataUrl,
      customerName: job.customerName,
      mobile: job.customerMobile,
      alternateMobile: job.alternateMobile ?? null,
      address: job.address,
      mapLink: job.mapLink ?? null,
      date: formatDate(job.scheduledDate),
      timeSlot: job.scheduledTime,
      service: SERVICE_LABELS[job.service] ?? job.service,
      flatType: job.serviceVariant ?? null,
      packageName: job.packageName ?? null,
      team: job.teamNumber ? `Team ${job.teamNumber}` : "—",
      crew: job.assignments.map((a) => a.staff.name).join(", ") || undefined,
      supervisor: job.supervisor?.name ?? "—",
      paymentStatus,
      jobValue: job.jobValue,
      advance,
      balance,
      notes: job.notes ?? null,
      audience,
    }))
  );

  const disposition = _request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="job-card-${job.jobNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
