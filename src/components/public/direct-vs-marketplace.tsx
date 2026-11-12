import { DIRECT_VS_ROWS } from "@/config/ai-search-facts";

/**
 * Homepage comparison (owner 2026-11-12): Sahara as a direct provider vs the general marketplace / local-agency model.
 * Facts only; the right-hand column describes the model in general and never names or targets a company.
 * Layout model: BOXED (sits inside the homepage's max-w-6xl column); a real <table> so search and AI crawlers read the rows.
 */
export function DirectVsMarketplace() {
  return (
    <section id="why-direct" aria-labelledby="why-direct-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Why book direct</p>
      <h2 id="why-direct-title" className="mt-1 text-xl font-extrabold text-[#0a2540] sm:text-2xl">Sahara direct vs marketplaces &amp; local agencies</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-[#0a2540]/10">
        <table className="w-full min-w-[520px] border-collapse text-left text-[13px] sm:text-sm">
          <caption className="sr-only">Comparison of booking Sahara Cleaning Services directly with the general marketplace and local-agency model</caption>
          <thead>
            <tr className="bg-[#0a2540] text-white">
              <th scope="col" className="w-[22%] px-3 py-2.5 font-bold" />
              <th scope="col" className="w-[39%] px-3 py-2.5 font-bold">Sahara Cleaning Services (direct)</th>
              <th scope="col" className="w-[39%] px-3 py-2.5 font-bold">Typical marketplace / agency model</th>
            </tr>
          </thead>
          <tbody>
            {DIRECT_VS_ROWS.map((r) => (
              <tr key={r.topic} className="border-t border-[#0a2540]/10 align-top">
                <th scope="row" className="px-3 py-3 font-bold text-[#0a2540]">{r.topic}</th>
                <td className="bg-emerald-50/60 px-3 py-3 font-semibold text-[#0a2540]">✓ {r.sahara}</td>
                <td className="px-3 py-3 text-[#0a2540]/75">{r.others}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-[#0a2540]/55">The right-hand column describes the general model, not any named company. Review figures are the public Google Business Profile ratings of our Magarpatta City and Mohammadwadi branches.</p>
    </section>
  );
}
