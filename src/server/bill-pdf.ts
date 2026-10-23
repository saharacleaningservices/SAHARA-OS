import QRCode from "qrcode";
import { getCompanySettings } from "@/server/settings";
import { publicFileToDataUrl, resolveBrandLogoDataUrl } from "@/lib/pdf/file-to-data-url";
import { COMPANY } from "@/lib/constants";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import type { BillDocumentProps } from "@/lib/pdf/sahara-bill-document";
import { UPI_QR_OPTIONS, upiPayUri } from "@/lib/upi";

/**
 * Header, payment details and QR shared by the quotation and invoice PDFs —
 * all from CRM Settings (nothing hard-coded). The QR encodes the configured UPI
 * ID with the amount due; if no UPI ID is set, the uploaded QR image is used.
 */
export async function billChrome(
  amountDue: number,
  _ref: string, // document number — kept for callers; the owner's UPI format carries no note
): Promise<Pick<BillDocumentProps, "company" | "logoDataUrl" | "bank" | "upiId" | "qrDataUrl" | "bookQrDataUrl" | "bookUrl">> {
  const settings = await getCompanySettings();
  const company = {
    name: settings.name || COMPANY.name,
    tagline: "Deep Cleaning & Painting Service.",
    phone: settings.phone || COMPANY.phones[0],
    email: settings.email || COMPANY.email,
    address: settings.address || COMPANY.address,
    website: settings.website || COMPANY.website,
    gstin: COMPANY.gstin,
    phones: [...COMPANY.phones],
  };
  const upiId = settings.upiId?.trim() || null;
  const bookUrl = `${PUBLIC_BOOKING_URL}/booking`;
  const [logoDataUrl, qrDataUrl, bookQrDataUrl] = await Promise.all([
    resolveBrandLogoDataUrl(settings.logoUrl),
    upiId
      ? QRCode.toDataURL(upiPayUri({ upiId, payeeName: company.name, amount: amountDue }), UPI_QR_OPTIONS)
      : settings.upiQrUrl
        ? publicFileToDataUrl(settings.upiQrUrl)
        : Promise.resolve(null),
    Promise.resolve(null), // (the "Scan to Book" footer QR was removed - owner 2026-10-24)
  ]);
  return {
    company,
    logoDataUrl,
    upiId,
    qrDataUrl,
    bookQrDataUrl,
    bookUrl,
    bank:
      settings.bankAccountNumber || settings.bankIfsc
        ? { name: settings.bankAccountName, ifsc: settings.bankIfsc, account: settings.bankAccountNumber, bankName: settings.bankName }
        : null,
  };
}
