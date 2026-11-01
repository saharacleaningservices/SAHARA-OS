// The one public origin for the website (owner 2026-11-01: main domain only, no booking.* / www split).
// No imports on purpose: safe to use from server and client modules and from plain unit tests.
export const MAIN_HOST = "saharacleaningservices.com";
export const SITE_ORIGIN = `https://${MAIN_HOST}`;
