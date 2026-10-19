// Owner-run: creates Campaign A (Click-to-WhatsApp) and Campaign B (website leads) in the Sahara ad account,
// every campaign and ad set with status PAUSED (nothing delivers, nothing is charged). Ads/creatives are added
// afterwards in Ads Manager, where the URL parameters below are pasted into each ad (Ad → Tracking → URL parameters).
//
//   Dry run (default, no token needed, makes no network call):
//     node scripts/meta-create-draft-campaigns.mjs --budget-inr 300 [--zones all]
//   Create for real (YOU run this; the token is read from the environment and never printed or stored):
//     META_ADS_TOKEN=<token with ads_management> META_PIXEL_ID=<pixel id> node scripts/meta-create-draft-campaigns.mjs --budget-inr 300 --apply [--zones all]
//
// Settings (env, all optional): AD_ACCOUNT_ID (default 2331727990935342), META_PAGE_ID (default 1880762258603818),
// WA_NUMBER (default +919175220270), META_API_VERSION (default v21.0).
// Locations are 3 km pins around each locality (Meta may reject PIN codes); the coordinates are approximate — check the
// audience map in Ads Manager before publishing. Budget is per ad set per day, set by the owner via --budget-inr.

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const bi = args.indexOf("--budget-inr");
const budgetInr = bi >= 0 ? Number(args[bi + 1]) : NaN;
if (!Number.isFinite(budgetInr) || budgetInr < 50) {
  console.error("Pass --budget-inr <daily budget per ad set in rupees, e.g. 300> (owner decision; minimum 50).");
  process.exit(1);
}

const ACT = (process.env.AD_ACCOUNT_ID || "2331727990935342").replace(/^act_/, "").replace(/\D/g, "");
const PAGE_ID = process.env.META_PAGE_ID || "1880762258603818";
const WA = (process.env.WA_NUMBER || "+919175220270").replace(/[^\d+]/g, "");
const PIXEL = process.env.META_PIXEL_ID || "";
const VER = process.env.META_API_VERSION || "v21.0";
const TOKEN = process.env.META_ADS_TOKEN || "";

// Zones. Phase 1 (Z1–Z3) is the default — the business base; add the rest (--zones all) after 2–3 weeks of CRM data.
// Approximate centres; PCMC is included in "all". Check the audience map in Ads Manager before publishing.
const PHASE1 = [
  ["Undri", 18.4575, 73.9086], ["NIBM", 18.4731, 73.8995], ["Kondhwa", 18.4637, 73.8869], ["Wanowrie", 18.4894, 73.8963],
  ["Hadapsar", 18.5089, 73.9259], ["Magarpatta", 18.5167, 73.9272], ["Amanora", 18.5176, 73.9343], ["Mundhwa", 18.5304, 73.9226],
  ["Kharadi", 18.5515, 73.94], ["Viman Nagar", 18.5679, 73.9143], ["Kalyani Nagar", 18.5463, 73.9021],
];
const PHASE2 = [
  // East
  ["Wagholi", 18.5800, 73.9800], ["Chandan Nagar", 18.5600, 73.9600], ["Lohegaon", 18.5900, 73.9200], ["Dhanori", 18.5900, 73.9000],
  // West (incl. PCMC)
  ["Baner", 18.5590, 73.7868], ["Balewadi", 18.5770, 73.7790], ["Wakad", 18.5990, 73.7600], ["Hinjewadi", 18.5910, 73.7380],
  ["Aundh", 18.5580, 73.8075], ["Kothrud", 18.5074, 73.8077], ["Pashan", 18.5400, 73.7900], ["Bavdhan", 18.5190, 73.7800],
  // South / Central
  ["Bibwewadi", 18.4720, 73.8650], ["Swargate", 18.5010, 73.8630], ["Camp", 18.5120, 73.8780], ["Deccan", 18.5160, 73.8420],
];
const zi = args.indexOf("--zones");
const zones = zi >= 0 ? args[zi + 1] : "1";
if (!["1", "all"].includes(zones)) {
  console.error("--zones must be 1 (default: Z1–Z3) or all (adds East, West/PCMC, South/Central).");
  process.exit(1);
}
const PLACES = zones === "all" ? [...PHASE1, ...PHASE2] : PHASE1;
const targeting = {
  age_min: 25,
  age_max: 55,
  geo_locations: {
    custom_locations: PLACES.map(([name, latitude, longitude]) => ({ name, latitude, longitude, radius: 3, distance_unit: "kilometer" })),
    location_types: ["home"], // people living here
  },
  targeting_automation: { advantage_audience: 1 },
};

const SERVICES = [
  ["home", "Home Deep Cleaning"],
  ["pest", "Pest Control"],
  ["painting", "Interior Painting"],
  ["facility", "Facility Management AMC"],
];
const LANDING = { home: "home-deep-cleaning-pune", pest: "pest-control-services-pune", painting: "interior-painting-pune", facility: "office-commercial-cleaning-pune" };
const UTM = "utm_source=meta_ads&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}";
const minor = Math.round(budgetInr * 100); // INR has a 100 offset in the Marketing API

const calls = [];
const plan = [];
function campaign(name, objective) {
  return { path: `act_${ACT}/campaigns`, body: { name, objective, status: "PAUSED", buying_type: "AUCTION", special_ad_categories: [], is_adset_budget_sharing_enabled: false } };
}
const A = campaign("meta_ctwa_pune_2026_10", "OUTCOME_ENGAGEMENT");
const B = campaign("meta_leads_pune_2026_10", "OUTCOME_LEADS");
plan.push({ kind: "campaign", ...A }, { kind: "campaign", ...B });
for (const [key, label] of SERVICES) {
  plan.push({
    kind: "adset", of: "A",
    path: `act_${ACT}/adsets`,
    body: {
      name: `ctwa_${key}`, status: "PAUSED", daily_budget: minor, billing_event: "IMPRESSIONS", optimization_goal: "CONVERSATIONS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP", destination_type: "WHATSAPP",
      promoted_object: { page_id: PAGE_ID, whatsapp_phone_number: WA }, targeting,
    },
    note: `${label} — add 2 ads with the pre-filled message in Ads Manager`,
  });
  plan.push({
    kind: "adset", of: "B",
    path: `act_${ACT}/adsets`,
    body: {
      name: `leads_${key}`, status: "PAUSED", daily_budget: minor, billing_event: "IMPRESSIONS", optimization_goal: "OFFSITE_CONVERSIONS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP", destination_type: "WEBSITE",
      promoted_object: { pixel_id: PIXEL || "<META_PIXEL_ID>", custom_event_type: "LEAD" }, targeting,
    },
    note: `${label} — landing page https://booking.saharacleaningservices.com/landing/${LANDING[key]}`,
  });
}

function show() {
  console.log(`Account act_${ACT} · ${PLACES.length} locality pins (zones ${zones}) · Page ${PAGE_ID} · WhatsApp ${WA} · budget ₹${budgetInr}/day per ad set · all PAUSED`);
  for (const s of plan) console.log(` - ${s.kind === "campaign" ? "CAMPAIGN " + s.body.name + " (" + s.body.objective + ")" : "  ad set " + s.of + "/" + s.body.name + (s.note ? " — " + s.note : "")}`);
  console.log(`\nURL parameters to paste into every ad (Ad → Tracking → URL parameters):\n  ${UTM}`);
}

async function post(path, body, token) {
  const res = await fetch(`https://graph.facebook.com/${VER}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    // Full Meta error (never includes the token) so a failed first run can be fixed without guessing.
    throw new Error(`${path}: ${e.message || res.status}${e.error_user_msg ? ` — ${e.error_user_msg}` : ""} [code ${e.code ?? "?"}/${e.error_subcode ?? "?"}, fbtrace ${e.fbtrace_id ?? "?"}]`);
  }
  return json.id;
}

show();
if (!apply) {
  console.log("\nDRY RUN — nothing was sent. Add --apply (with META_ADS_TOKEN and META_PIXEL_ID set) to create these as PAUSED.");
  process.exit(0);
}
if (!TOKEN) { console.error("META_ADS_TOKEN is not set."); process.exit(1); }
if (!PIXEL) { console.error("META_PIXEL_ID is not set (needed for Campaign B)."); process.exit(1); }

const ids = {};
try {
  ids.A = await post(A.path, A.body, TOKEN);
  ids.B = await post(B.path, B.body, TOKEN);
  console.log(`\nCreated campaigns A=${ids.A}, B=${ids.B}`);
  for (const s of plan.filter((x) => x.kind === "adset")) {
    const id = await post(s.path, { ...s.body, campaign_id: ids[s.of] }, TOKEN);
    console.log(`  ad set ${s.of}/${s.body.name} = ${id}`);
  }
  console.log("\nDone. Everything is PAUSED. Add ads (creatives, copy, URL parameters) in Ads Manager, then review and publish yourself.");
} catch (e) {
  console.error("\nStopped:", e.message, "\nAlready created:", JSON.stringify(ids), "— delete or reuse them in Ads Manager.");
  process.exit(1);
}
