import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/session";
import { getJobDetail, canAccessJob, getOwnStaffId } from "@/server/jobs";
import { getCompanySettings } from "@/server/settings";
import { JobCardDocument } from "@/lib/pdf/job-card-document";
import { publicFileToDataUrl } from "@/lib/pdf/file-to-data-url";
import { SERVICE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

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

  const settings = await getCompanySettings();
  const logoDataUrl = settings.logoUrl ? await publicFileToDataUrl(settings.logoUrl) : null;

  const advance = job.payments.reduce((s, p) => s + (p.paidAmount ?? 0), 0);
  const balance = Math.max(job.jobValue - advance, 0);
  const paymentStatus =
    balance <= 0 && advance > 0 ? "Paid" : advance > 0 ? "Partly Paid" : "Pending";

  const buffer = await renderToBuffer(
    JobCardDocument({
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
      team: job.teamNumber ? `Team ${job.teamNumber}` : "—",
      supervisor: job.supervisor?.name ?? "—",
      paymentStatus,
      jobValue: job.jobValue,
      advance,
      balance,
      notes: job.notes ?? null,
    })
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
