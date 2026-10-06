import { FileText } from "lucide-react";
import { parsePackage, lineAmount } from "@/lib/package-calc";
import { formatINR } from "@/lib/utils";

/**
 * Customer-facing "Your Quotation" — the confirmed package and itemised lines
 * of the customer's own job. Only names, quantities, the customer price per
 * line, discount and final total — never cost, margin, staff or internal notes.
 */
export function BookingQuotationSection({
  jobNumber,
  service,
  packageName,
  serviceVariant,
  included,
  serviceItems,
  discountAmount,
  total,
}: {
  jobNumber: string;
  service: string;
  packageName: string | null;
  serviceVariant: string | null;
  included: string[];
  serviceItems: string | null;
  discountAmount: number | null;
  total: number;
}) {
  const lines = parsePackage(serviceItems, discountAmount).lines;
  const discount = Math.max(0, discountAmount ?? 0);

  return (
    <div id="quotation" className="space-y-3 rounded-2xl bg-white p-5 text-sm shadow-sm">
      <p className="flex items-center justify-between font-semibold text-[#0a2540]">
        <span className="flex items-center gap-2">
          <FileText className="size-4 text-primary" /> Your Quotation
        </span>
        <span className="text-xs font-medium text-[#0a2540]/60">{jobNumber}</span>
      </p>
      <div>
        <p className="font-semibold">{service}</p>
        {(packageName || serviceVariant) && (
          <p className="text-[#0a2540]/80">
            Package: <span className="font-semibold">{packageName || serviceVariant}</span>
            {packageName && serviceVariant ? ` · ${serviceVariant}` : ""}
          </p>
        )}
      </div>

      {lines.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {lines.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block break-words">{l.name}</span>
                <span className="block text-xs text-[#0a2540]/60">Qty {l.qty}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">{formatINR(lineAmount(l))}</span>
            </li>
          ))}
        </ul>
      )}

      {included.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Services included</p>
          <ul className="mt-1 list-disc pl-5">
            {included.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1 border-t pt-2">
        {discount > 0 && (
          <p className="flex justify-between">
            <span>Discount</span>
            <span className="tabular-nums">− {formatINR(discount)}</span>
          </p>
        )}
        {total > 0 && (
          <p className="flex justify-between text-base font-bold text-[#0a2540]">
            <span>Final total</span>
            <span className="tabular-nums">{formatINR(total)}</span>
          </p>
        )}
      </div>
      <p className="text-xs text-[#0a2540]/60">Service scope for your package is listed below.</p>
    </div>
  );
}
