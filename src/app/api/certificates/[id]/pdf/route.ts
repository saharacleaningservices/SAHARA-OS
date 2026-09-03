import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { CertificateDocument } from "@/lib/pdf/certificate-document";
import { publicFileToDataUrl } from "@/lib/pdf/file-to-data-url";
import { formatDate } from "@/lib/utils";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const certificate = await db.certificate.findUnique({ where: { id } });

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  const signatureDataUrl = certificate.signatureUrl ? await publicFileToDataUrl(certificate.signatureUrl) : null;

  const buffer = await renderToBuffer(
    CertificateDocument({
      certificateNumber: certificate.certificateNumber,
      issuedDate: formatDate(certificate.issuedDate),
      customerName: certificate.customerName,
      serviceSummary: certificate.serviceSummary,
      supervisorName: certificate.supervisorName,
      signatureUrl: certificate.signatureUrl,
      signatureDataUrl,
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${certificate.certificateNumber}.pdf"`,
    },
  });
}
