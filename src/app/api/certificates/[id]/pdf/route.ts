import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { CertificateDocument } from "@/lib/pdf/certificate-document";
import { publicFileToDataUrl, resolveBrandLogoDataUrl } from "@/lib/pdf/file-to-data-url";
import { formatDate } from "@/lib/utils";
import { getCompanySettings } from "@/server/settings";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Previously had NO auth check at all — anyone with the (hard-to-guess but
  // unauthenticated) URL could view a customer's name and service summary.
  // Its only real callers are the Job detail page and Reports, both already
  // behind a login, so requiring any signed-in session closes the gap
  // without needing per-role scope logic (unlike Payments-adjacent
  // documents, a completion certificate isn't sensitive enough to warrant
  // restricting which role can view one they can already see a link to).
  const { id } = await params;
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const certificate = await db.certificate.findUnique({ where: { id } });

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  const signatureDataUrl = certificate.signatureUrl ? await publicFileToDataUrl(certificate.signatureUrl) : null;
  const settings = await getCompanySettings();
  const logoDataUrl = await resolveBrandLogoDataUrl(settings.logoUrl);

  const buffer = await renderToBuffer(
    CertificateDocument({
      certificateNumber: certificate.certificateNumber,
      issuedDate: formatDate(certificate.issuedDate),
      customerName: certificate.customerName,
      serviceSummary: certificate.serviceSummary,
      supervisorName: certificate.supervisorName,
      signatureUrl: certificate.signatureUrl,
      signatureDataUrl,
      logoDataUrl,
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${certificate.certificateNumber}.pdf"`,
    },
  });
}
