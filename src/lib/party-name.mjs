// Party-name cleaning (owner CRM data standard, 2026-11-04): names are stored
// clean — no "Cus"/"Mr"/"Shree" prefixes, no role words, no location tags.
// Plain ESM + JSDoc so the same rules run in the app (TypeScript, allowJs) and
// in scripts/clean-party-names.mjs on the production container (Node 20, no tsx).

/** Leading honorifics / bookkeeping prefixes, stripped repeatedly ("Cus Mr. Rahul"). */
const PREFIX = /^(?:cus|cust|customer|mr|mrs|ms|miss|dr|shree|shri|sri|smt|m\/s|messrs)(?:\.|\b)[\s.:\-–]*/i;

/** Role words → suggested Customer.contactType. Longest first so "Interior Designer" wins over "Interior". */
const ROLE_WORDS = [
  ["interior designers", "INTERIOR_DESIGNER"],
  ["interior designer", "INTERIOR_DESIGNER"],
  ["architects", "ARCHITECT"],
  ["architect", "ARCHITECT"],
  ["brokers", "BROKER"],
  ["broker", "BROKER"],
  ["customer", null],
  ["cust", null],
  ["cus", null],
];
/** Honorific tails with no category meaning. */
const TAIL_WORDS = ["sir", "madam", "mam", "maam", "ma'am", "ji", "saheb", "sahab"];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const ROLE_TAIL = new RegExp(`[\\s(\\[\\-–_/]+(${ROLE_WORDS.map(([w]) => esc(w)).join("|")})[\\s)\\].]*$`, "i");
const ROLE_HEAD = new RegExp(`^(${ROLE_WORDS.filter(([, t]) => t).map(([w]) => esc(w)).join("|")})\\b[\\s.:\\-–]+`, "i");
const HONORIFIC_TAIL = new RegExp(`[\\s(\\[\\-–_]+(${TAIL_WORDS.map(esc).join("|")})[\\s)\\].]*$`, "i");

/** Title-cases words only when the whole name was typed in lower case (keeps "ABC Pvt Ltd", "McDonald"). */
function fixCase(s) {
  if (s !== s.toLowerCase()) return s;
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/**
 * @param {string | null | undefined} raw
 * @returns {{ name: string, changed: boolean, suggestedType: string | null, removed: string[] }}
 *   name "" means nothing usable was left — flag for manual review, never save.
 */
// Pune localities / landmarks seen at the end of party names in production ("Amar Kharadi",
// "Prashant Dhyani Dhanori"). Stripped only from the 2nd word on, never from company names.
const LOCALITIES = new Set(`pune pcmc kharadi khardi hadapsar magarpatta kondhwa kondwa nibm undri amanora phursungi fursungi baner kothrud wagholi
camp wanowarie wanowari wanawadi wanwadi handewadi kalepadal pisoli dhanori katraj wakad mundhwa vimannagar vimanagar vimanager kalyaninagar
warje bibvewadi bavdhan aundh yerwada shewalwadi loni pashan swargate mohammadwadi mohammedwadi mohamadwadi m.wadi mwadi keshavnagar
hinjewadi hinjawadi balewadi pimpri chinchwad akurdi nigdi moshi bhosari chakan talegaon lohegaon kesnand manjari manjri manjree uruli saswad
sinhagad singhgad deccan shivajinagar koregaon ghorpadi lullanagar gultekdi dhankawadi ambegaon narhe dhayari vadgaon vadgaun wadgaon khadki
ravet tathawade punawale thergaon rahatni kalewadi sangvi dapodi bopodi bopkhel vishrantwadi tingrenagar dighi alandi chandannagar ramtekdi
nanded kirkatwadi pirangut`.split(/\s+/));
// Words that end a place phrase: "Keshav Nagar", "Handewadi Road", "Sadashiv Peth", "Forest County".
const PLACE_SUFFIX = new Set(`nagar road rd peth wadi park tower towers society soc city colony vihar baug bag county enclave chambers mall annex
apartment apartments apt heights residency complex chowk township town phase sector`.split(/\s+/));
// First word of well-known two-word Pune places ("Viman Nagar", "Koregaon Park", "Sinhagad Road") — safe to cut from the 2nd word on.
const PLACE_FIRST = new Set(`viman kalyani keshav mahadev fatima tingre chandan sayyed bhekrai sasane shivaji koregaon sadashiv rasta somwar
mangalwar budhwar shukrawar guruwar ganesh narayan kasba bhavani sinhagad singhgad solapur nagar satara paud karve ahmednagar handewadi bt
nibm magarpatta amanora forest model market sopan salunkhe nanded mohammed mohammad mohamed lulla vadgaon vadgaun wadgaon`.split(/\s+/));
// Trailing notes that are not part of a name.
const NOTE_TAIL = new Set(["office", "site", "home", "flat", "shop", "offi", "ofc"]);
// Company / institution names keep every word.
const COMPANY = /\b(pvt|private|ltd|limited|llp|inc|corp|company|co\.|hotel|hotels|hospital|clinic|school|college|academy|bank|industries|enterprises?|solutions|services|technologies|tech|infra|developers|builders|constructions?|realty|group|foundation|trust|associates|restaurant|cafe|bakers?|traders|agency|motors|pharma|labs?|studio|centre|center|mall|plaza|showroom|store|stores|mart|interiors?)\b/i;

/** Drops a trailing place / note phrase, keeping at least the first word. */
function stripPlaceTail(s, removed) {
  if (COMPANY.test(s)) return s;
  const w = s.split(" ");
  if (w.length < 2) return s;
  const low = w.map((x) => x.toLowerCase().replace(/[.]+$/, ""));
  for (let i = 1; i < w.length; i++) {
    const hit = LOCALITIES.has(low[i]) || LOCALITIES.has(low[i].replace(/\./g, "")) || (i + 1 < w.length && PLACE_SUFFIX.has(low[i + 1]) && (PLACE_FIRST.has(low[i]) || (i + 1 === w.length - 1 && i >= 2))) || (NOTE_TAIL.has(low[i]) && i === w.length - 1);
    if (hit) {
      removed.push(w.slice(i).join(" "));
      return w.slice(0, i).join(" ");
    }
  }
  return s;
}

/** "Neha Surana Neha Surana" → "Neha Surana". */
function collapseRepeat(s) {
  const w = s.split(" ");
  if (w.length % 2 === 0) {
    const h = w.length / 2;
    if (w.slice(0, h).join(" ").toLowerCase() === w.slice(h).join(" ").toLowerCase()) return w.slice(0, h).join(" ");
  }
  return s;
}

export function cleanPartyName(raw) {
  const original = String(raw ?? "");
  const removed = [];
  const hint = { type: null };
  let s = original.replace(/[\u00a0\t\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();

  // "(Rahatni)" / "[site]" notes.
  s = s.replace(/\s*[(\[]([^)\]]*)[)\]]\s*/g, (m, inner) => {
    const tag = inner.trim();
    const role = ROLE_WORDS.find(([w]) => w === tag.toLowerCase());
    if (role && role[1]) hint.type = hint.type ?? role[1];
    if (tag) removed.push(tag);
    return " ";
  }).trim();

  // Comma / " - " / " @ " / " | " separated parts: "Cus, Name, Area" → the first part that is a name.
  const parts = s.split(/\s*,\s*|\s+(?:-|–|@|\|)\s+/).map((p) => p.trim()).filter(Boolean);
  let name = "";
  for (const part of parts) {
    if (name) {
      removed.push(part);
      continue;
    }
    const c = cleanCore(part, removed, hint);
    if (c) name = c;
  }

  // Firm names keep their words ("Padams Interiors"), but still hint the category.
  let suggestedType = hint.type;
  if (!suggestedType && /\binteriors?\b/i.test(name)) suggestedType = "INTERIOR_DESIGNER";
  if (!suggestedType && /\b(architects?|archi)\b/i.test(name)) suggestedType = "ARCHITECT";
  if (!suggestedType && /\b(estate|realty|properties|realtors?)\b/i.test(name)) suggestedType = "BROKER";

  name = fixCase(name.replace(/\s{2,}/g, " "));
  return { name, changed: name !== original.trim(), suggestedType, removed: removed.filter(Boolean) };
}

/** Prefixes, role words, honorifics and place tails of one part, repeated until stable. "" = nothing usable. */
function cleanCore(input, removed, hint) {
  let s = input;
  for (let guard = 0; guard < 8; guard++) {
    const before = s;
    const p = s.match(PREFIX);
    if (p && p[0].length < s.length) {
      removed.push(p[0].trim());
      s = s.slice(p[0].length).trim();
    } else if (p && p[0].length === s.length) {
      removed.push(s);
      s = "";
    }
    const head = s.match(ROLE_HEAD);
    if (head) {
      const role = ROLE_WORDS.find(([w]) => w === head[1].toLowerCase());
      hint.type = hint.type ?? (role ? role[1] : null);
      removed.push(head[1]);
      s = s.slice(head[0].length).trim();
    }
    const tail = s.match(ROLE_TAIL);
    if (tail) {
      const role = ROLE_WORDS.find(([w]) => w === tail[1].toLowerCase());
      if (role && role[1]) hint.type = hint.type ?? role[1];
      removed.push(tail[1]);
      s = s.slice(0, tail.index).trim();
    } else if (ROLE_WORDS.some(([w]) => w === s.toLowerCase())) {
      const role = ROLE_WORDS.find(([w]) => w === s.toLowerCase());
      if (role && role[1]) hint.type = hint.type ?? role[1];
      removed.push(s);
      s = "";
    }
    const hon = s.match(HONORIFIC_TAIL);
    if (hon) {
      removed.push(hon[1]);
      s = s.slice(0, hon.index).trim();
    }
    // Honorifics repeated inside the name ("Neha Surana Dr Neha Surana").
    s = s.replace(/\s+(?:mr|mrs|ms|dr|smt)\.?(?=\s)/gi, (m) => {
      removed.push(m.trim());
      return "";
    });
    s = s.replace(/^[\s.,:;\-–_/]+|[\s.,:;\-–_/]+$/g, "").replace(/\s{2,}/g, " ").trim();
    s = collapseRepeat(s);
    s = stripPlaceTail(s, removed);
    if (s === before) break;
  }
  // Nothing but digits / punctuation left is not a name.
  // Phone-book placeholders ("Unsaved Contact - 98…", "Unknown") and single letters ("Mr. U") are not names.
  if (/^(unsaved contact|unknown|no name|new contact|test)$/i.test(s) || s.replace(/[^a-z\u0900-\u097f]/gi, "").length < 2) {
    if (s) removed.push(s);
    s = "";
  }
  // A part that is only a place ("Rahatni", "Pune") is not a name.
  if (s && s.split(" ").every((w) => LOCALITIES.has(w.toLowerCase().replace(/\./g, "")) || PLACE_SUFFIX.has(w.toLowerCase()))) {
    removed.push(s);
    s = "";
  }
  return /[a-z\u0900-\u097f]/i.test(s) ? s : "";
}
