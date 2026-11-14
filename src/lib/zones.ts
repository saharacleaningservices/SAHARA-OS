// Service-zone geo-routing + Minimum Order Value (MOV) rules.
//
// Pure module (no server imports) so the public booking form can show the
// zone hint client-side while the server action remains the enforcer.
//
//   ZONE_1  East & South Pune         — no MOV (standard per-service MOQs only)
//   ZONE_2  West Pune & Inner PCMC    — ₹4,000 MOV
//   ZONE_3  Far NW / Industrial belt  — Commercial/Industrial free; Residential ₹7,500 MOV

export type ZoneId = "ZONE_1" | "ZONE_2" | "ZONE_3";

export type ZoneConfig = {
  id: ZoneId;
  name: string;
  shortName: string;
  /** Minimum order value for residential/home bookings (0 = none). */
  residentialMov: number;
  /** Minimum order value for commercial/industrial bookings (0 = none). */
  commercialMov: number;
  localities: string[];
  pincodes: string[];
  /** Footnote shown on locality pages / booking form. */
  footnote: string | null;
  /** Message shown when a residential order is below the MOV. */
  residentialBlockMessage: string | null;
};

export const ZONES: Record<ZoneId, ZoneConfig> = {
  ZONE_1: {
    id: "ZONE_1",
    name: "Core East & South Pune",
    shortName: "East & South Pune",
    residentialMov: 0,
    commercialMov: 0,
    localities: [
      "Magarpatta", "Hadapsar", "Kharadi", "Viman Nagar", "Koregaon Park", "Kalyani Nagar", "Wagholi",
      "Mohammadwadi", "Undri", "NIBM", "Kondhwa", "Wanowrie", "Katraj", "Dhankawadi", "Bibwewadi",
      "Swargate", "Sahakar Nagar", "Satara Road",
    ],
    // Includes adjacent East/South pincodes (Mundhwa/Keshav Nagar 411036, Fatima Nagar 411013, Pune Camp 411001).
    pincodes: ["411028", "411013", "411014", "411006", "411001", "411036", "412207", "411060", "411048", "411040", "411046", "411043", "411037", "411042", "411009"],
    footnote: null,
    residentialBlockMessage: null,
  },
  ZONE_2: {
    id: "ZONE_2",
    name: "West Pune & Inner PCMC",
    shortName: "West Pune & PCMC",
    residentialMov: 4000,
    commercialMov: 4000,
    localities: [
      "Shivajinagar", "Kothrud", "Karve Nagar", "Warje", "Bavdhan", "Pashan", "Aundh", "Baner", "Balewadi",
      "Wakad", "Hinjewadi", "Punawale", "Pimple Saudagar", "Pimpri", "Chinchwad",
    ],
    pincodes: ["411005", "411038", "411052", "411058", "411021", "411008", "411007", "411045", "411057", "411033", "411027", "411017", "411018", "411019"],
    footnote: "*Min. order value ₹4,000 applies for West Pune & PCMC",
    residentialBlockMessage:
      "Minimum order value for West Pune & PCMC is ₹4,000. Please add more services or upgrade your package to proceed.",
  },
  ZONE_3: {
    id: "ZONE_3",
    name: "Far Outer North-West / Industrial Belt",
    shortName: "Chakan, Moshi, Ravet, Talegaon & Alandi",
    residentialMov: 7500,
    commercialMov: 0,
    localities: ["Chakan", "Moshi", "Ravet", "Talegaon", "Alandi"],
    pincodes: ["410501", "412105", "412101", "410507"],
    footnote: "*Commercial / Industrial projects accepted freely. Residential: min. order value ₹7,500",
    residentialBlockMessage:
      "For Chakan, Moshi, Ravet, Talegaon & Alandi, we accept Commercial Cleaning projects or Full Home / Villa packages of ₹7,500 and above.",
  },
};

export const ZONE_3_RESIDENTIAL_MOV = ZONES.ZONE_3.residentialMov;
export const ZONE_2_MOV = ZONES.ZONE_2.residentialMov;

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Alias → zone. Longest alias wins so "pimple saudagar" beats "pimpri" etc.
const ALIASES: { alias: string; zone: ZoneId }[] = [];
for (const z of Object.values(ZONES)) {
  for (const l of z.localities) ALIASES.push({ alias: norm(l), zone: z.id });
}
const EXTRA_ALIASES: [string, ZoneId][] = [
  ["magarpatta city", "ZONE_1"], ["amanora", "ZONE_1"], ["koregaon park", "ZONE_1"], ["mundhwa", "ZONE_1"],
  ["keshav nagar", "ZONE_1"], ["bibwewadi", "ZONE_1"], ["bibvewadi", "ZONE_1"], ["pimpri chinchwad", "ZONE_2"],
  ["pcmc", "ZONE_2"], ["karve road", "ZONE_2"], ["pimple gurav", "ZONE_2"], ["talegaon dabhade", "ZONE_3"],
  ["chikhali", "ZONE_3"], ["moshi", "ZONE_3"],
];
for (const [alias, zone] of EXTRA_ALIASES) ALIASES.push({ alias: norm(alias), zone });
ALIASES.sort((a, b) => b.alias.length - a.alias.length);

const PINCODE_ZONE = new Map<string, ZoneId>();
for (const z of Object.values(ZONES)) for (const p of z.pincodes) PINCODE_ZONE.set(p, z.id);

export type ZoneMatch = { zone: ZoneConfig; locality: string | null; matchedBy: "locality" | "pincode" };

/** Resolve a free-text area/address and/or pincode to a zone. Locality name wins over pincode. */
export function resolveZone(input: { area?: string | null; address?: string | null; pincode?: string | null }): ZoneMatch | null {
  const hay = ` ${norm([input.area, input.address].filter(Boolean).join(" "))} `;
  if (hay.trim()) {
    for (const { alias, zone } of ALIASES) {
      if (hay.includes(` ${alias} `)) return { zone: ZONES[zone], locality: alias, matchedBy: "locality" };
    }
  }
  const pin = (input.pincode ?? "").replace(/\D/g, "");
  if (pin.length === 6 && PINCODE_ZONE.has(pin)) {
    return { zone: ZONES[PINCODE_ZONE.get(pin)!], locality: null, matchedBy: "pincode" };
  }
  return null;
}

export type CustomerType = "RESIDENTIAL" | "COMMERCIAL";

const COMMERCIAL_CATEGORIES = new Set(["COMMERCIAL_CLEANING", "COMMERCIAL"]);

export function customerTypeFor(serviceCategory?: string | null, explicit?: string | null): CustomerType {
  if (explicit === "COMMERCIAL" || explicit === "RESIDENTIAL") return explicit;
  return serviceCategory && COMMERCIAL_CATEGORIES.has(serviceCategory) ? "COMMERCIAL" : "RESIDENTIAL";
}

/** MOV (₹) that applies for a zone + customer type. 0 = none. */
export function minimumOrderValue(zone: ZoneId | null | undefined, customerType: CustomerType): number {
  if (!zone) return 0;
  const z = ZONES[zone];
  return customerType === "COMMERCIAL" ? z.commercialMov : z.residentialMov;
}

export type MovCheck = { ok: true } | { ok: false; min: number; message: string };

/** Server-side MOV gate. Unmapped zones are not restricted here (callers flag them for manual review). */
export function checkMinimumOrder(input: { zone: ZoneId | null | undefined; customerType: CustomerType; total: number }): MovCheck {
  const min = minimumOrderValue(input.zone, input.customerType);
  if (min <= 0 || input.total >= min) return { ok: true };
  const z = ZONES[input.zone!];
  return {
    ok: false,
    min,
    message: z.residentialBlockMessage ?? `Minimum order value for ${z.shortName} is ₹${min.toLocaleString("en-IN")}.`,
  };
}

/**
 * Floor applied to CRM jobs/quotes. Unmapped areas keep the legacy ₹3,999
 * floor; Zone 1 has none (the global ₹3,999 rule no longer applies there).
 */
export function crmMinimumJobValue(area: string | null | undefined, customerType: CustomerType, legacyFloor: number, pincode?: string | null): number {
  const match = resolveZone({ area, pincode });
  if (!match) return legacyFloor;
  return minimumOrderValue(match.zone.id, customerType);
}
