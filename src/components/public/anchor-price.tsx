import { anchorPrice } from "@/lib/savings";

/** Muted struck-through "was" price + small discount badge, shown beside a selling price. Renders nothing when switched off. */
export function AnchorPrice({ price, className = "" }: { price: number | null | undefined; className?: string }) {
  const a = anchorPrice(price);
  if (!a) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 align-middle ${className}`}>
      <s className="text-sm font-semibold text-[#0a2540]/40" aria-label={`Original price ₹${a.was.toLocaleString("en-IN")}`}>₹{a.was.toLocaleString("en-IN")}</s>
      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700 ring-1 ring-emerald-200">{a.pct}% OFF</span>
    </span>
  );
}
