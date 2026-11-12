import { Check, X } from "lucide-react";
import { SCOPE_ROWS, scopeNotIncluded } from "@/config/scope-checklist";

/**
 * "What's included — exact scope" (owner 2026-11-12). Server component, no client JS, adds only an H2 (the page keeps its single H1).
 * Layout model: BOXED card inside the page's existing max-w-6xl column on desktop (two-column table); fluid stacked cards on mobile.
 */
export function ScopeChecklist() {
  return (
    <section id="exact-scope" aria-labelledby="exact-scope-h" className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <h2 id="exact-scope-h" className="text-lg font-bold text-[#0a2540]">What&apos;s included — exact scope</h2>
      <p className="mt-1 text-sm text-[#0a2540]/70">Written down before you book, so you know what the crew will and will not do — furnished home or empty flat.</p>

      {/* Desktop: table. */}
      <div className="mt-3 hidden overflow-hidden rounded-xl border sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#0a2540]/5 text-xs uppercase tracking-wide text-[#0a2540]/70">
            <tr><th scope="col" className="px-3 py-2">Area</th><th scope="col" className="px-3 py-2">Furnished (Premium / Platinum)</th><th scope="col" className="px-3 py-2">Unfurnished (empty flat)</th></tr>
          </thead>
          <tbody>
            {SCOPE_ROWS.map((r) => (
              <tr key={r.area} className="border-t align-top">
                <th scope="row" className="px-3 py-2 font-semibold text-[#0a2540]">{r.area}</th>
                <td className="px-3 py-2">{r.furnished}</td>
                <td className="px-3 py-2">{r.unfurnished}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per area. */}
      <ul className="mt-3 space-y-2 sm:hidden">
        {SCOPE_ROWS.map((r) => (
          <li key={r.area} className="rounded-xl border p-3 text-sm">
            <p className="font-semibold text-[#0a2540]">{r.area}</p>
            <p className="mt-1 flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /><span><b>Furnished:</b> {r.furnished}</span></p>
            <p className="mt-1 flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /><span><b>Unfurnished:</b> {r.unfurnished}</span></p>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-bold text-[#0a2540]">Not included</h3>
      <ul className="mt-1.5 grid gap-1 text-sm text-[#0a2540]/80 sm:grid-cols-2">
        {scopeNotIncluded().map((t) => (
          <li key={t} className="flex gap-1.5"><X className="mt-0.5 size-4 shrink-0 text-rose-500" aria-hidden />{t}</li>
        ))}
      </ul>
    </section>
  );
}
