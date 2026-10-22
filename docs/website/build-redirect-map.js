// Draft 301 map generator: old WordPress URLs (from the public sitemap) -> proposed new-site paths.
// Pure data transform; reads old-urls.txt, writes the CSV. Run: node build-redirect-map.js <old-urls.txt> <out.csv>
const fs = require("fs");
const [,, inFile, outFile] = process.argv;
const urls = fs.readFileSync(inFile, "utf8").split(/\r?\n/).filter(Boolean);

const SERVICE = { // locality-page prefix -> canonical new service page
  "window-cleaning-services": ["window-cleaning", "NO"],
  "sofa-cleaning-services": ["sofa-cleaning", "NO"],
  "office-cleaning-services": ["office-cleaning", "NO"],
  "mattress-steam-services": ["mattress-cleaning", "NO"],
  "mattress-cleaning-services": ["mattress-cleaning", "NO"],
  "housekeeping-services": ["housekeeping", "NO"],
  "house-cleaning-services": ["home-deep-cleaning", "NO"],
  "home-deep-cleaning-services": ["home-deep-cleaning", "NO"],
  "deep-cleaning-services": ["home-deep-cleaning", "NO"],
  "cleaning-services": ["home-deep-cleaning", "YES"],     // generic title: confirm it should not be its own page
  "carpet-cleaning-services": ["carpet-cleaning", "NO"],
  "bungalows-cleaning-services": ["home-deep-cleaning", "YES"], // bungalows may deserve a dedicated page (high-value)
  "bathroom-cleaning-services": ["bathroom-cleaning", "NO"],
};
const LOCALITIES = ["pune", "undri", "kharadi", "hadapsar", "mohammadwadi", "amanora-park"];
const re = new RegExp(`^/(${Object.keys(SERVICE).join("|")})-in-(${LOCALITIES.join("|")})/$`);

// Non-locality pages: explicit decisions [new_path, status, action, reason, ownerReview]
const S = (slug) => `/services/${slug}/`;
const FIXED = {
  "/": ["/", 200, "KEEP", "R1 homepage stays at the root", "NO"],
  "/about/": ["/about/", 200, "KEEP", "R1 same path on the new site", "NO"],
  "/contact/": ["/contact/", 200, "KEEP", "R1 same path on the new site", "NO"],
  "/privacy-policy/": ["/privacy-policy/", 200, "KEEP", "R1 same path on the new site", "NO"],
  "/services/": ["/services/", 200, "KEEP", "R1 services hub keeps its path", "NO"],
  "/more-services/": ["/services/", 301, "REDIRECT_301", "R3 merged into the services hub", "NO"],
  "/online-booking/": ["/book/", 301, "REDIRECT_301", "R3 old booking page -> new booking flow", "NO"],
  "/photo-gallery/": ["/gallery/", 301, "REDIRECT_301", "R3 one gallery page", "NO"],
  "/video-gallery/": ["/gallery/", 301, "REDIRECT_301", "R3 one gallery page", "NO"],
  "/housekeeping-services/": [S("housekeeping"), 301, "REDIRECT_301", "R3 service root page", "NO"],
  "/deep-cleaning-services/": [S("home-deep-cleaning"), 301, "REDIRECT_301", "R3 service root page", "NO"],
  "/sofa-cleaning-shampooing/": [S("sofa-cleaning"), 301, "REDIRECT_301", "R3 same service", "NO"],
  "/bathroom-cleaning-service/": [S("bathroom-cleaning"), 301, "REDIRECT_301", "R3 same service", "NO"],
  "/window-cleaning/": [S("window-cleaning"), 301, "REDIRECT_301", "R3 same service", "NO"],
  "/kitchen-cleaning/": [S("kitchen-cleaning"), 301, "REDIRECT_301", "R3 same service", "NO"],
  "/mattress-cleaning/": [S("mattress-cleaning"), 301, "REDIRECT_301", "R3 same service", "NO"],
  "/carpet-cleaning/": [S("carpet-cleaning"), 301, "REDIRECT_301", "R3 same service", "NO"],
  "/corporate-office-cleaning/": [S("office-cleaning"), 301, "REDIRECT_301", "R3 commercial/office cluster", "NO"],
  "/business-office-cleaning/": [S("office-cleaning"), 301, "REDIRECT_301", "R3 commercial/office cluster", "NO"],
  "/commercial-deep-cleaning/": [S("office-cleaning"), 301, "REDIRECT_301", "R3 commercial/office cluster", "NO"],
  "/house-deep-cleaning/": [S("home-deep-cleaning"), 301, "REDIRECT_301", "R3 same service", "NO"],
  "/intensive-deep-cleaning/": [S("home-deep-cleaning"), 301, "REDIRECT_301", "R3 same service", "NO"],
  "/residential-apartment-cleaning/": [S("home-deep-cleaning"), 301, "REVIEW", "R4 apartment cleaning: dedicated page or part of deep cleaning?", "YES"],
  "/one-time-cleaning/": [S("home-deep-cleaning"), 301, "REVIEW", "R4 unclear intent: confirm target", "YES"],
  "/steam-cleaning/": ["/services/", 301, "REVIEW", "R4 steam cleaning spans sofa/carpet/mattress: pick one target", "YES"],
  "/chair-cleaning-residential-commercial/": [S("sofa-cleaning"), 301, "REVIEW", "R4 upholstery: confirm it belongs with sofa cleaning", "YES"],
  "/building-and-housing-society-cleaning/": [S("society-cleaning"), 301, "REVIEW", "R4 society cleaning: new page needed? (high-value commercial)", "YES"],
  "/end-of-tenancy-cleaning/": [S("move-in-out-cleaning"), 301, "REVIEW", "R4 merge with move-in/move-out page?", "YES"],
  "/move-in-move-out-cleaning/": [S("move-in-out-cleaning"), 301, "REVIEW", "R4 new move-in/out page needed?", "YES"],
};

const rows = [["old_path", "new_path", "http_status", "action", "rule_and_reason", "owner_review"]];
const seen = new Set();
for (const u of urls) {
  let r;
  const m = re.exec(u);
  if (m) {
    const [slug, review] = SERVICE[m[1]];
    const isPune = m[2] === "pune";
    r = [S(slug), 301, review === "YES" ? "REVIEW" : "REDIRECT_301",
      isPune ? "R2 Pune page == the service's main page" : `R2 ${m[2]} page is a near-identical copy of the Pune page (audit 15 Oct): consolidate; locality hub decision (Q5) may change the target`,
      review];
  } else if (FIXED[u]) r = FIXED[u];
  else r = ["", "", "UNMAPPED", "no rule: decide manually", "YES"];
  seen.add(u);
  rows.push([u, ...r.map(String)]);
}
const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n") + "\n";
fs.writeFileSync(outFile, csv);

// ---- self-checks (fail loudly) ----
const body = rows.slice(1);
const old = new Set(body.map((r) => r[0]));
const problems = [];
if (body.length !== urls.length || old.size !== urls.length) problems.push("row count != url count or duplicate old_path");
for (const r of body) {
  if (r[3] === "UNMAPPED") problems.push("unmapped " + r[0]);
  if (r[3] !== "KEEP" && old.has(r[1])) {
    // a redirect target that is itself an OLD path which redirects elsewhere = chain
    const t = body.find((x) => x[0] === r[1]);
    if (t && t[3] !== "KEEP") problems.push(`chain ${r[0]} -> ${r[1]} -> ${t[1]}`);
  }
  if (r[3] === "KEEP" && r[0] !== r[1]) problems.push("KEEP path differs " + r[0]);
}
const by = (k) => body.reduce((a, r) => ((a[r[k]] = (a[r[k]] || 0) + 1), a), {});
console.log("rows:", body.length, "| action:", JSON.stringify(by(3)), "| owner_review YES:", body.filter((r) => r[5] === "YES").length);
console.log("distinct new targets:", new Set(body.map((r) => r[1])).size);
if (problems.length) { console.error("PROBLEMS:\n" + problems.join("\n")); process.exit(1); }
console.log("self-checks OK (every URL mapped, no duplicates, no chains)");
