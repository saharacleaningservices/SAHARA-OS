// Match unassigned CRM jobs to Khatabook site entries (owner 2026-11-06, Task 7). Pure + unit-tested.
// A Khatabook wage row reads like "Mundhwa Job", "Office Kharadi Job", "Auto Fare Pisoli Job".

const STOP = new Set(["job", "jobs", "auto", "fare", "site", "visit", "work", "office", "flat", "the", "and", "for", "pune", "road", "near", "extra", "half", "day", "full", "travel", "allowance"]);

/** Site name of a Khatabook row ("Office Kharadi Job" → "Office Kharadi"); null when it is not a job/site row. */
export function siteOf(desc: string): string | null {
  const d = desc.replace(/\s+/g, " ").trim();
  if (!/\bjob\b|\bsite\b/i.test(d)) return null;
  const s = d.replace(/\b(auto\s*fare|job|site|visit)\b/gi, " ").replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return s || null;
}

const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length >= 4 && !STOP.has(t));

/** True when a site name and a job's area/address/customer share a meaningful word (4+ letters, prefix match). */
export function siteMatchesJob(site: string, job: { area: string; address: string; customerName: string }) {
  const st = tokens(site);
  if (!st.length) return false;
  const jt = tokens(`${job.area} ${job.address} ${job.customerName}`);
  return st.some((a) => jt.some((b) => a.slice(0, 5) === b.slice(0, 5)));
}

export type KhataSiteRow = { khataName: string; date: string; desc: string };
export type OpenJob = { id: string; date: string; area: string; address: string; customerName: string };

/**
 * For each job: the Khatabook parties who logged a matching site on that date. A job is assigned only when every
 * matching row on that date names the same site and that site matches no other open job of the same date.
 */
export function matchJobs(jobs: OpenJob[], rows: KhataSiteRow[]) {
  const out: { jobId: string; site: string | null; khataNames: string[]; status: "MATCHED" | "AMBIGUOUS" | "NO_MATCH"; reason: string }[] = [];
  for (const j of jobs) {
    const sameDay = rows.map((r) => ({ ...r, site: siteOf(r.desc) })).filter((r) => r.date === j.date && r.site);
    const hits = sameDay.filter((r) => siteMatchesJob(r.site!, j));
    if (!hits.length) {
      out.push({ jobId: j.id, site: null, khataNames: [], status: "NO_MATCH", reason: sameDay.length ? `${sameDay.length} Khatabook site row(s) that day, none at this area` : "no Khatabook site row that day" });
      continue;
    }
    const sites = [...new Set(hits.map((h) => h.site!.toLowerCase()))];
    const rivals = jobs.filter((o) => o.id !== j.id && o.date === j.date && hits.some((h) => siteMatchesJob(h.site!, o)));
    const names = [...new Set(hits.map((h) => h.khataName.trim()))];
    if (sites.length > 1 || rivals.length) {
      out.push({ jobId: j.id, site: hits[0].site, khataNames: names, status: "AMBIGUOUS", reason: rivals.length ? `site also matches ${rivals.length} other job(s) that day` : `different site names: ${sites.join(" / ")}` });
      continue;
    }
    out.push({ jobId: j.id, site: hits[0].site, khataNames: names, status: "MATCHED", reason: `${names.length} staff logged "${hits[0].site}" on ${j.date}` });
  }
  return out;
}
