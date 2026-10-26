"use client";

import { useSyncExternalStore } from "react";

// CRM header language (English / हिंदी / मराठी) for the office roles — Admin, Operations, Accounts.
// Translates the navigation and header chrome. Choice is kept in this browser's localStorage (owner 2026-10-18);
// the Staff App has its own per-phone language (lib/staff-i18n.ts). Page bodies stay in English.

export type CrmLang = "en" | "hi" | "mr";
export const CRM_LANGS: { code: CrmLang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "hi", label: "हिंदी", short: "HI" },
  { code: "mr", label: "मराठी", short: "MR" },
];
const KEY = "sahara_crm_lang";
const EVENT = "sahara-crm-lang";
const isLang = (v: unknown): v is CrmLang => v === "en" || v === "hi" || v === "mr";

export function getCrmLang(): CrmLang {
  try {
    const v = window.localStorage.getItem(KEY);
    return isLang(v) ? v : "en";
  } catch {
    return "en";
  }
}
export function setCrmLang(l: CrmLang) {
  try {
    window.localStorage.setItem(KEY, l);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
  // Page bodies stay English: keep <html lang="en"> so the browser never auto-translates documents / swaps digits to Devanagari.
  document.documentElement.dataset.crmLang = l;
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
/** Current language; "en" on the server and for the first client render, so hydration always matches. */
export const useCrmLang = (): CrmLang => useSyncExternalStore(subscribe, getCrmLang, () => "en");

const HI: Record<string, string> = {
  "Dashboards & Reports": "डैशबोर्ड और रिपोर्ट", Operations: "ऑपरेशन्स", "Sales & Finance": "बिक्री और वित्त", "Tools & AI": "टूल्स और AI", "Settings & Admin": "सेटिंग्स और एडमिन",
  "Sales & CRM": "बिक्री और CRM", "Finance & Billing": "वित्त और बिलिंग", "Reports & Profit": "रिपोर्ट और मुनाफ़ा",
  "Sales Dashboard": "बिक्री डैशबोर्ड", "Sales Vouchers": "बिक्री वाउचर", "Proforma Invoice": "प्रोफ़ॉर्मा इनवॉइस", "Credit Note": "क्रेडिट नोट", "Delivery Challan": "डिलीवरी चालान", "Purchase Vouchers": "खरीद वाउचर",
  "Lifecycle Reminders": "ग्राहक रिमाइंडर", Parties: "पार्टियाँ", Sales: "बिक्री", Purchases: "खरीद", "Purchases & Expenses": "खरीद और खर्च", "Quotation / Estimate": "कोटेशन / अनुमान", "Sales Invoices": "बिक्री इनवॉइस", "Payment In": "प्राप्त भुगतान",
  Dashboard: "डैशबोर्ड", Reports: "रिपोर्ट", "Revenue Dashboard": "आय डैशबोर्ड", "Profit Dashboard": "मुनाफ़ा डैशबोर्ड", "Marketing Dashboard": "मार्केटिंग डैशबोर्ड",
  Jobs: "जॉब्स", "Team Dispatch": "टीम डिस्पैच", "Slot Availability": "स्लॉट उपलब्धता", Staff: "स्टाफ", Vehicles: "वाहन", Attendance: "हाज़िरी", "AMC Contracts": "AMC अनुबंध",
  Housekeeping: "हाउसकीपिंग", "Pest Control": "पेस्ट कंट्रोल", "Interior Painting": "इंटीरियर पेंटिंग", Gallery: "गैलरी", Trash: "ट्रैश",
  "Leads / CRM": "लीड्स / CRM", Customers: "ग्राहक", Quotations: "कोटेशन", Invoices: "इनवॉइस", Payments: "भुगतान", Expenses: "खर्च", "Price List": "मूल्य सूची", "Service Catalog": "सेवा सूची", "Prices & Service Catalog": "मूल्य और सेवा सूची",
  "AI Assistant": "AI सहायक", "WhatsApp Inbox": "व्हाट्सऐप इनबॉक्स", "Message Log": "संदेश लॉग", Announcements: "घोषणाएँ",
  "Pricing & Packages": "मूल्य और पैकेज", "User Management": "यूज़र प्रबंधन", "Audit Log": "ऑडिट लॉग", "Device Approvals": "डिवाइस अनुमोदन", "Security Approvals": "सुरक्षा अनुमोदन", "Export Center": "एक्सपोर्ट सेंटर", "Khata Book Import": "खाता बुक इम्पोर्ट", "Quick Quote Generator": "क्विक कोट जनरेटर", "Payment Link Sender": "पेमेंट लिंक भेजें", "Team Dispatch & Slots": "टीम डिस्पैच और स्लॉट", "Team & Attendance": "टीम और हाज़िरी", "Specialized Services": "विशेष सेवाएँ",
  "My Profile": "मेरी प्रोफ़ाइल", Settings: "सेटिंग्स", "Log out": "लॉग आउट", "Need help?": "मदद चाहिए?", Language: "भाषा", "Open navigation": "मेनू खोलें",
};
const MR: Record<string, string> = {
  "Dashboards & Reports": "डॅशबोर्ड आणि अहवाल", Operations: "ऑपरेशन्स", "Sales & Finance": "विक्री आणि वित्त", "Tools & AI": "टूल्स आणि AI", "Settings & Admin": "सेटिंग्ज आणि अ‍ॅडमिन",
  "Sales & CRM": "विक्री आणि CRM", "Finance & Billing": "वित्त आणि बिलिंग", "Reports & Profit": "अहवाल आणि नफा",
  "Sales Dashboard": "विक्री डॅशबोर्ड", "Sales Vouchers": "विक्री व्हाउचर", "Proforma Invoice": "प्रोफॉर्मा इनव्हॉइस", "Credit Note": "क्रेडिट नोट", "Delivery Challan": "डिलिव्हरी चलन", "Purchase Vouchers": "खरेदी व्हाउचर",
  "Lifecycle Reminders": "ग्राहक रिमाइंडर", Parties: "पार्टीज", Sales: "विक्री", Purchases: "खरेदी", "Purchases & Expenses": "खरेदी आणि खर्च", "Quotation / Estimate": "कोटेशन / अंदाज", "Sales Invoices": "विक्री इनव्हॉइस", "Payment In": "मिळालेले पेमेंट",
  Dashboard: "डॅशबोर्ड", Reports: "अहवाल", "Revenue Dashboard": "उत्पन्न डॅशबोर्ड", "Profit Dashboard": "नफा डॅशबोर्ड", "Marketing Dashboard": "मार्केटिंग डॅशबोर्ड",
  Jobs: "जॉब्स", "Team Dispatch": "टीम डिस्पॅच", "Slot Availability": "स्लॉट उपलब्धता", Staff: "कर्मचारी", Vehicles: "वाहने", Attendance: "हजेरी", "AMC Contracts": "AMC करार",
  Housekeeping: "हाउसकीपिंग", "Pest Control": "पेस्ट कंट्रोल", "Interior Painting": "इंटीरियर पेंटिंग", Gallery: "गॅलरी", Trash: "कचरा",
  "Leads / CRM": "लीड्स / CRM", Customers: "ग्राहक", Quotations: "कोटेशन", Invoices: "इनव्हॉइस", Payments: "देयके", Expenses: "खर्च", "Price List": "किंमत यादी", "Service Catalog": "सेवा सूची", "Prices & Service Catalog": "किंमत व सेवा सूची",
  "AI Assistant": "AI सहाय्यक", "WhatsApp Inbox": "व्हॉट्सअ‍ॅप इनबॉक्स", "Message Log": "संदेश लॉग", Announcements: "घोषणा",
  "Pricing & Packages": "किंमत आणि पॅकेज", "User Management": "वापरकर्ता व्यवस्थापन", "Audit Log": "ऑडिट लॉग", "Device Approvals": "डिव्हाइस मंजुरी", "Security Approvals": "सुरक्षा मंजुरी", "Export Center": "एक्सपोर्ट सेंटर", "Khata Book Import": "खाता बुक इम्पोर्ट", "Quick Quote Generator": "क्विक कोट जनरेटर", "Payment Link Sender": "पेमेंट लिंक पाठवा", "Team Dispatch & Slots": "टीम डिस्पॅच आणि स्लॉट", "Team & Attendance": "टीम आणि हजेरी", "Specialized Services": "विशेष सेवा",
  "My Profile": "माझी प्रोफाइल", Settings: "सेटिंग्ज", "Log out": "लॉग आउट", "Need help?": "मदत हवी आहे?", Language: "भाषा", "Open navigation": "मेनू उघडा",
};
const PACKS: Record<CrmLang, Record<string, string>> = { en: {}, hi: HI, mr: MR };

/** English text → the chosen language; anything without a translation stays English. */
export const crmT = (lang: CrmLang, text: string): string => PACKS[lang][text] ?? text;
export const crmTranslations = { hi: HI, mr: MR };
