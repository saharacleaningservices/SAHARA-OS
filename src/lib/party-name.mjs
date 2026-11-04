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
export function cleanPartyName(raw) {
  const original = String(raw ?? "");
  const removed = [];
  let suggestedType = null;
  let s = original.replace(/[ \t\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();

  // Location / note tags: everything after the first comma, "(Rahatni)", " - Wakad", " @ Baner".
  const comma = s.indexOf(",");
  if (comma >= 0) {
    removed.push(s.slice(comma + 1).trim());
    s = s.slice(0, comma).trim();
  }
  s = s.replace(/\s*[(\[]([^)\]]*)[)\]]\s*/g, (m, inner) => {
    const tag = inner.trim();
    const role = ROLE_WORDS.find(([w]) => w === tag.toLowerCase());
    if (role && role[1]) suggestedType = suggestedType ?? role[1];
    if (tag) removed.push(tag);
    return " ";
  }).trim();
  s = s.replace(/\s+(?:-|–|@|\|)\s+(.+)$/, (m, tag) => {
    removed.push(tag.trim());
    return "";
  }).trim();

  // Prefixes and role/honorific words, repeated until stable.
  for (let guard = 0; guard < 6; guard++) {
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
      suggestedType = suggestedType ?? (role ? role[1] : null);
      removed.push(head[1]);
      s = s.slice(head[0].length).trim();
    }
    const tail = s.match(ROLE_TAIL);
    if (tail) {
      const role = ROLE_WORDS.find(([w]) => w === tail[1].toLowerCase());
      if (role && role[1]) suggestedType = suggestedType ?? role[1];
      removed.push(tail[1]);
      s = s.slice(0, tail.index).trim();
    } else if (ROLE_WORDS.some(([w]) => w === s.toLowerCase())) {
      const role = ROLE_WORDS.find(([w]) => w === s.toLowerCase());
      if (role && role[1]) suggestedType = suggestedType ?? role[1];
      removed.push(s);
      s = "";
    }
    const hon = s.match(HONORIFIC_TAIL);
    if (hon) {
      removed.push(hon[1]);
      s = s.slice(0, hon.index).trim();
    }
    s = s.replace(/^[\s.,:;\-–_/]+|[\s.,:;\-–_/]+$/g, "").trim();
    if (s === before) break;
  }

  // Firm names keep their words ("Padams Interiors"), but still hint the category.
  if (!suggestedType && /\binteriors?\b/i.test(s)) suggestedType = "INTERIOR_DESIGNER";
  if (!suggestedType && /\b(architects?|archi)\b/i.test(s)) suggestedType = "ARCHITECT";
  if (!suggestedType && /\b(estate|realty|properties|realtors?)\b/i.test(s)) suggestedType = "BROKER";

  // Nothing but digits / punctuation left is not a name.
  if (!/[a-zऀ-ॿ]/i.test(s)) s = "";
  s = fixCase(s.replace(/\s{2,}/g, " "));
  return { name: s, changed: s !== original.trim(), suggestedType, removed: removed.filter(Boolean) };
}
