// Staff name search that survives the spellings used in WhatsApp, Khatabook and the CRM (owner 2026-11-06):
// "Matin Bagwan" finds "Matin Bhagwan", "Mosek Uncle" finds "Moses", "Hk Rahman" finds "Rehman". Pure functions.

const GROUPS: string[][] = [
  ["sheikh", "shaikh", "shaik", "sheik", "shekh", "shaikh"],
  ["bhagwan", "bagwan"],
  ["aayesha", "ayesha", "aaisha", "ayeesha"],
  ["moses", "mosek", "moshe"],
  ["rehman", "rahman", "rehaman"],
  ["rehan", "rihan", "rayan"],
  ["mohammad", "mohammed", "muhammad", "mohamed", "md"],
  ["giyasuddin", "giyashuddin", "gyasuddin", "ghiyasuddin"],
  ["nilu", "nilo", "neelu"],
  ["kaleem", "kalim", "kaleam"],
  ["sohel", "suhel", "suhail"],
  ["tohid", "tauhid", "touheed"],
  ["inamdar", "inaamdar"],
  ["amir", "aamir", "ameer"],
];

/** Words that people type around a name but are not part of it. */
const FILLER = new Set(["uncle", "bhai", "sir", "ji", "mr", "ms", "mrs", "hk", "madam", "mam", "bhaiya", "didi", "aunty"]);

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** The words of a query that identify a person (filler dropped; the original words if nothing else is left). */
export function staffSearchTokens(query: string): string[] {
  const all = clean(query).split(" ").filter(Boolean);
  const kept = all.filter((t) => !FILLER.has(t));
  return kept.length ? kept : all;
}

/** Every spelling of one word that should count as the same word (always includes the word itself). */
export function spellingVariants(token: string): string[] {
  const t = token.toLowerCase();
  const out = new Set<string>([t]);
  for (const g of GROUPS) if (g.includes(t)) g.forEach((x) => out.add(x));
  return [...out];
}
