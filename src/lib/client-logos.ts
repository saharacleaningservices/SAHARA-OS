// Corporate clients shown in the /booking "Trusted by" slider (owner 2026-10-26).
// Real clients only: the slider stays hidden while this list is empty — never put a company here without its permission.
// To add one: run `python3 scripts/convert-client-logos.py <folder of logo files>` (transparent PNG-24 into public/clients/),
// then add the printed line here — `name` must match its CLIENT_NAMES spelling so the homepage strip swaps the name tile for the logo:
//   { name: "Example Pvt Ltd", src: "/clients/example.png" },
export type ClientLogo = { name: string; src: string };
// Owner 2026-11-03: logos supplied by the owner, converted to transparent PNG-24 (scripts/convert-client-logos.py).
export const CLIENT_LOGOS: ClientLogo[] = [
  { name: "Renom Technologies", src: "/clients/renom-technologies.png" },
  { name: "Eaton Technologies", src: "/clients/eaton-technologies.png" },
  { name: "BMW", src: "/clients/bmw.png" },
  { name: "Clover Hills", src: "/clients/clover-hills.png" },
  { name: "ABIL", src: "/clients/abil.png" },
  { name: "National Insurance", src: "/clients/national-insurance.png" },
  { name: "Panther Nails", src: "/clients/panther-nails.png" },
  { name: "Gagan Developers", src: "/clients/gagan-developers.png" },
  { name: "Padam Interiors", src: "/clients/padam-interiors.png" },
  { name: "Studio XP", src: "/clients/studio-xp.png" },
  { name: "Manav Group", src: "/clients/manav-group.png" },
  { name: "Hawa Valves", src: "/clients/hawa-valves.png" },
  { name: "Famic Technologies", src: "/clients/famic-technologies.png" },
];

/**
 * Official client list for the homepage "Trusted by" marquee (owner 2026-11-02, final; BHEL removed). Shown as wordmark tiles until
 * each client's own logo file is added to CLIENT_LOGOS above — logos are used only as supplied by / approved by that client.
 */
export const CLIENT_NAMES = ["Renom Technologies", "Eaton Technologies", "BMW", "Clover Hills", "ABIL", "National Insurance", "Panther Nails", "Gagan Developers", "Leisure Town", "Padam Interiors", "Studio XP", "Manav Group", "Hawa Valves", "Famic Technologies"] as const;
