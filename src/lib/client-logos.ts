// Corporate clients shown in the /booking "Trusted by" slider (owner 2026-10-26).
// Real clients only: the slider stays hidden while this list is empty — never put a company here without its permission.
// To add one: drop the logo (PNG / WebP / SVG, transparent background, ~300 px wide) into public/clients/ and add a line:
//   { name: "Example Pvt Ltd", src: "/clients/example.png" },
export type ClientLogo = { name: string; src: string };
export const CLIENT_LOGOS: ClientLogo[] = [];

/**
 * Official client list for the homepage "Trusted by" marquee (owner 2026-11-02, final; BHEL removed). Shown as wordmark tiles until
 * each client's own logo file is added to CLIENT_LOGOS above — logos are used only as supplied by / approved by that client.
 */
export const CLIENT_NAMES = ["Renom Technologies", "Eaton Technologies", "Clover Hills", "ABIL", "Leisure Town", "Panthernails", "Padam Interiors", "Studio XP"] as const;
