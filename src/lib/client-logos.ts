// Corporate clients shown in the /booking "Trusted by" slider (owner 2026-10-26).
// Real clients only: the slider stays hidden while this list is empty — never put a company here without its permission.
// To add one: drop the logo (PNG / WebP / SVG, transparent background, ~300 px wide) into public/clients/ and add a line:
//   { name: "Example Pvt Ltd", src: "/clients/example.png" },
export type ClientLogo = { name: string; src: string };
export const CLIENT_LOGOS: ClientLogo[] = [];

/**
 * Verified corporate clients the owner approved for the homepage marquee (2026-11-02). Shown as text wordmarks until each client's
 * logo file is added to CLIENT_LOGOS above (logos only with that client's permission).
 */
export const CLIENT_NAMES = ["RENOM Technologies", "Clover Hills", "BHEL", "Eaton Technologies"] as const;
