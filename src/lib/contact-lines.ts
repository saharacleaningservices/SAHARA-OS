import { BRANCHES } from "@/config/pune-seo-matrix";
import { CONTACT } from "@/lib/marketing-content";

// The two numbers the floating contact button offers (owner 2026-11-03). Kept in a tiny module so the client FAB does not pull the
// header / menu code into its bundle.
export const PRIMARY_CALL = CONTACT.call[0];
export const PRIMARY_WHATSAPP = BRANCHES.magarpatta.whatsapp;
export const FAB_WA_TEXT = "Hi Sahara, I'd like a quote for a service in Pune.";
