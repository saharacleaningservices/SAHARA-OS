// Cognito Forms "Post JSON data to a website" payload -> the plain enquiry fields used by src/server/enquiry-intake.ts.
// Pure, no I/O. Cognito sends one JSON object per entry whose top-level keys are the form's field names (e.g. Name,
// Phone, Email, Address, Service, Message) plus metadata objects such as Entry { Number, ... } and Form { Id, ... }.
// Field names differ per form, so matching is by key pattern, case-insensitive, and also looks one level into nested
// section objects. Owner: send one test entry after setup and check the lead (docs/COGNITO_CRM_SETUP_CHECKLIST.md).

export type CognitoEnquiry = {
  name: string;
  mobile: string; // last 10 digits, "" when none found
  email: string;
  location: string;
  service: string;
  message: string;
  /** Stable id for this entry (form + entry number) — used as the idempotency key. "" when Cognito sent none. */
  entryRef: string;
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const META_KEYS = /^(entry|form|\$|_)/i;

const text = (v: unknown, max = 400): string => {
  if (typeof v === "string") return v.trim().slice(0, max);
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (Array.isArray(v)) return v.map((x) => text(x, max)).filter(Boolean).join(", ").slice(0, max);
  return "";
};

/** Every non-metadata field: top level plus one level inside section objects that are not themselves typed values. */
function fields(body: Obj): [string, unknown][] {
  const out: [string, unknown][] = [];
  for (const [k, v] of Object.entries(body)) {
    if (META_KEYS.test(k)) continue;
    out.push([k, v]);
    if (isObj(v) && !isNameObj(v) && !isAddressObj(v)) for (const [k2, v2] of Object.entries(v)) if (!META_KEYS.test(k2)) out.push([k2, v2]);
  }
  return out;
}

const isNameObj = (v: Obj) => "First" in v || "Last" in v || "FirstAndLast" in v;
const isAddressObj = (v: Obj) => "Line1" in v || "City" in v || "PostalCode" in v || "FullAddress" in v;

const pick = (all: [string, unknown][], re: RegExp) => all.find(([k, v]) => re.test(k) && v != null && v !== "")?.[1];

function nameOf(v: unknown): string {
  if (isObj(v)) {
    const full = text(v.FirstAndLast) || [text(v.First), text(v.Middle), text(v.Last)].filter(Boolean).join(" ");
    return full.slice(0, 120);
  }
  return text(v, 120);
}

function addressOf(v: unknown): string {
  if (isObj(v)) {
    const parts = [text(v.Line1), text(v.Line2), text(v.City), text(v.PostalCode)].filter(Boolean);
    return (parts.length ? parts.join(", ") : text(v.FullAddress)).slice(0, 200);
  }
  return text(v, 200);
}

export function parseCognitoEntry(body: unknown, formHint = ""): CognitoEnquiry {
  const b = isObj(body) ? body : {};
  const all = fields(b);
  const phoneRaw = text(pick(all, /^(mobile|phone|whats ?app|contact ?(no|number)|cell)/i), 40);
  const digits = phoneRaw.replace(/\D/g, "");
  const entry = isObj(b.Entry) ? b.Entry : {};
  const form = isObj(b.Form) ? b.Form : {};
  const entryNo = text(entry.Number) || text(entry.Id) || text(b.Id);
  const formId = text(form.Id) || text(form.InternalName) || text(formHint, 60) || "form";
  const emailRaw = text(pick(all, /^e-?mail/i), 200).toLowerCase();
  return {
    name: nameOf(pick(all, /^(name|full ?name|your ?name|customer ?name)$/i) ?? pick(all, /name/i)),
    mobile: digits.length >= 10 ? digits.slice(-10) : "",
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : "",
    location: addressOf(pick(all, /(address|location|locality|area|society|city)/i)),
    service: text(pick(all, /(service|subject|requirement|what.*need|package)/i), 200),
    message: text(pick(all, /(message|comment|note|detail|description|query|requirement ?details)/i), 1000),
    entryRef: entryNo ? `${formId}:${entryNo}` : "",
  };
}
