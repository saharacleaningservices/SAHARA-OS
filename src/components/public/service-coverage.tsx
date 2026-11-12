import Link from "next/link";
import { B2B_COVERAGE, B2C_COVERAGE, type CoverageItem } from "@/config/geo-coverage";

function Column({ title, items }: { title: string; items: CoverageItem[] }) {
  return (
    <div>
      <h3 className="text-base font-extrabold text-[#0a2540]">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i.name}><Link href={i.href} className="font-semibold text-primary hover:underline">{i.name}</Link><span className="text-[#0a2540]/65"> — {i.note}</span></li>
        ))}
      </ul>
    </div>
  );
}

/** "What we clean" — every B2C and B2B service type in plain, linkable text (read by search engines and AI assistants). */
export function ServiceCoverage({ show = "both" }: { show?: "both" | "b2c" | "b2b" }) {
  return (
    <section aria-labelledby="coverage-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <h2 id="coverage-title" className="text-xl font-extrabold text-[#0a2540] sm:text-2xl">What we clean in Pune &amp; PCMC</h2>
      <div className={`mt-4 grid gap-6 ${show === "both" ? "md:grid-cols-2" : ""}`}>
        {show !== "b2b" && <Column title="Homes & residential (B2C)" items={B2C_COVERAGE} />}
        {show !== "b2c" && <Column title="Commercial & facility management (B2B)" items={B2B_COVERAGE} />}
      </div>
    </section>
  );
}
