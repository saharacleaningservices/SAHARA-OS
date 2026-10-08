import QRCode from "qrcode";
import { getCompanySettings } from "@/server/settings";
import { publicFileToDataUrl, resolveBrandLogoDataUrl } from "@/lib/pdf/file-to-data-url";
import { COMPANY } from "@/lib/constants";
import type { BillDocumentProps } from "@/lib/pdf/sahara-bill-document";

/**
 * Header, payment details and QR shared by the quotation and invoice PDFs —
 * all from CRM Settings (nothing hard-coded). The QR encodes the configured UPI
 * ID with the amount due; if no UPI ID is set, the uploaded QR image is used.
 */
export async function billChrome(
  amountDue: number,
  ref: string,
): Promise<Pick<BillDocumentProps, "company" | "logoDataUrl" | "bank" | "upiId" | "qrDataUrl">> {
  const settings = await getCompanySettings();
  const company = {
    name: settings.name || COMPANY.name,
    tagline: "Deep Cleaning & Painting Service.",
    phone: settings.phone || COMPANY.phones[0],
    email: settings.email || COMPANY.email,
    address: settings.address || COMPANY.address,
    website: settings.website || COMPANY.website,
    gstin: COMPANY.gstin,
  };
  const upiId = settings.upiId?.trim() || null;
  const [logoDataUrl, qrDataUrl] = await Promise.all([
    resolveBrandLogoDataUrl(settings.logoUrl),
    upiId
      ? QRCode.toDataURL(
          `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(company.name)}&am=${Math.max(0, Math.round(amountDue))}&cu=INR&tn=${encodeURIComponent(ref)}`,
          { margin: 1, width: 240 },
        )
      : settings.upiQrUrl
        ? publicFileToDataUrl(settings.upiQrUrl)
        : Promise.resolve(null),
  ]);
  return {
    company,
    logoDataUrl,
    upiId,
    qrDataUrl,
    bank:
      settings.bankAccountNumber || settings.bankIfsc
        ? { name: settings.bankAccountName, ifsc: settings.bankIfsc, account: settings.bankAccountNumber, bankName: settings.bankName }
        : null,
  };
}
