// Corporate clients shown in the /booking "Trusted by" slider (owner 2026-10-26).
// Real clients only: the slider stays hidden while this list is empty — never put a company here without its permission.
// To add one: drop the logo (PNG / WebP / SVG, transparent background, ~300 px wide) into public/clients/ and add a line:
//   { name: "Example Pvt Ltd", src: "/clients/example.png" },
export type ClientLogo = { name: string; src: string };
export const CLIENT_LOGOS: ClientLogo[] = [];
