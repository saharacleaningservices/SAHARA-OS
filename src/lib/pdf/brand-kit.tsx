import path from "node:path";
import { Circle, Font, Image, Link, Path, Polygon, Rect, Svg, Text, View } from "@react-pdf/renderer";

/**
 * Shared building blocks for the Sahara quotation / invoice / job-card PDFs (owner master list, 2026-10-25):
 *  - one embedded font (Poppins, OFL) so the real ₹ sign and Hindi text render — the built-in Helvetica has neither;
 *  - money / number formatting pinned to Latin digits (never Devanagari "१०", whatever the server or browser locale);
 *  - the payment block (bank details left, large scannable UPI QR right — no raw URLs);
 *  - the corporate footer (bold blue category strip + clickable vector icons for contact and social links).
 */

const FONT_DIR = path.join(process.cwd(), "public", "fonts", "poppins");
let registered = false;
export function registerBrandFonts() {
  if (registered) return;
  registered = true;
  Font.register({ family: "Sahara", src: path.join(FONT_DIR, "Poppins-Regular.ttf") });
  Font.register({ family: "Sahara-Medium", src: path.join(FONT_DIR, "Poppins-Medium.ttf") });
  Font.register({ family: "Sahara-Bold", src: path.join(FONT_DIR, "Poppins-Bold.ttf") });
  Font.register({ family: "Sahara-Italic", src: path.join(FONT_DIR, "Poppins-Italic.ttf") });
  // Whole words only (no "SER-VICES" hyphenation).
  Font.registerHyphenationCallback((word) => [word]);
}
registerBrandFonts();

export const FONT = { regular: "Sahara", medium: "Sahara-Medium", bold: "Sahara-Bold", italic: "Sahara-Italic" } as const;

/** Latin digits with Indian grouping, always — "-u-nu-latn" blocks Devanagari numerals on any ICU / locale. */
const NF = new Intl.NumberFormat("en-IN-u-nu-latn", { maximumFractionDigits: 2 });
const DEVANAGARI_DIGITS = /[०-९]/g;
/** Belt and braces: map any stray Devanagari digit back to 0-9. */
export const latinDigits = (s: string) => s.replace(DEVANAGARI_DIGITS, (d) => String(d.charCodeAt(0) - 0x0966));
export const num = (n: number) => latinDigits(NF.format(Number.isFinite(n) ? n : 0));
/** "₹7,000" — exact amount, never rounded. */
export const inr = (n: number) => `₹${num(n)}`;

export const BRAND_BLUE = "#1E40AF";
const SOFT = "#eff4ff";
const INK = "#0f172a";
const MUTED = "#475569";

export const FOOTER_CATEGORIES = ["HOME DEEP CLEANING", "COMMERCIAL CLEANING", "PEST CONTROL", "INTERIOR PAINTING", "HOUSEKEEPING & AMC"];

export const SOCIAL_LINKS = {
  instagram: "https://www.instagram.com/saharacleaningservices.pune/",
  facebook: "https://www.facebook.com/saharacleaningservices",
  youtube: "https://www.youtube.com/channel/UCHfIf88WCd5HE0L1CU5iBXA",
  google: "https://g.page/r/CYJ9szEiGaN4EBE/review",
} as const;

// ---------- Vector icons (react-pdf cannot use icon fonts). 24×24 view box. ----------
const P = {
  phone: "M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z",
  mail: "M3 5h18v14H3V5zm9 8L4.5 7v-.5h15V7L12 13z",
  globe: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 2c1.6 1.7 2.6 4 2.9 7H9.1c.3-3 1.3-5.3 2.9-7zM4.3 13h3.3c.1 1.9.5 3.6 1.2 5.1A8 8 0 014.3 13zm3.3-2H4.3a8 8 0 014.5-5.1C8.1 7.4 7.7 9.1 7.6 11zm4.4 9c-1.6-1.7-2.6-4-2.9-7h5.8c-.3 3-1.3 5.3-2.9 7zm3.2-1.9c.7-1.5 1.1-3.2 1.2-5.1h3.3a8 8 0 01-4.5 5.1zM16.4 11c-.1-1.9-.5-3.6-1.2-5.1A8 8 0 0119.7 11h-3.3z",
  pin: "M12 2a7 7 0 00-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z",
  facebook: "M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V10.5H7.8v3h2.6V21h3.1z",
};

type IconName = "phone" | "mail" | "globe" | "pin" | "instagram" | "facebook" | "youtube" | "google";
export function BrandIcon({ name, size = 9, color = BRAND_BLUE }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      {name === "instagram" ? (
        <>
          <Rect x="3" y="3" width="18" height="18" rx="5" ry="5" fill={color} />
          <Circle cx="12" cy="12" r="4.2" fill="#ffffff" />
          <Circle cx="12" cy="12" r="2.6" fill={color} />
          <Circle cx="17.2" cy="6.8" r="1.2" fill="#ffffff" />
        </>
      ) : name === "youtube" ? (
        <>
          <Rect x="2" y="5" width="20" height="14" rx="4" ry="4" fill={color} />
          <Polygon points="10,8.8 15.5,12 10,15.2" fill="#ffffff" />
        </>
      ) : name === "google" ? (
        // Review star
        <Polygon points="12,2.5 14.9,8.6 21.5,9.3 16.5,13.8 17.9,20.4 12,17 6.1,20.4 7.5,13.8 2.5,9.3 9.1,8.6" fill={color} />
      ) : name === "facebook" ? (
        <>
          <Circle cx="12" cy="12" r="10" fill={color} />
          <Path d={P.facebook} fill="#ffffff" />
        </>
      ) : (
        <Path d={P[name]} fill={color} />
      )}
    </Svg>
  );
}

// ---------- Payment block: bank details left, big UPI QR right ----------
export type PaymentBlockProps = {
  bank?: { name?: string | null; ifsc?: string | null; account?: string | null; bankName?: string | null } | null;
  upiId?: string | null;
  qrDataUrl?: string | null;
  /** Amount encoded in the QR (shown under it). */
  amount?: number | null;
  /** Theme colours: royal blue for quotations (default), maroon for invoices. */
  accent?: string;
  soft?: string;
  k?: number;
};
export function hasPaymentBlock(p: PaymentBlockProps) {
  return !!(p.bank?.account || p.bank?.ifsc || p.qrDataUrl || p.upiId);
}
export function PaymentBlock(p: PaymentBlockProps) {
  const k = p.k ?? 1;
  const accent = p.accent ?? BRAND_BLUE;
  const soft = p.soft ?? SOFT;
  const z = (n: number) => Math.round(n * k * 10) / 10;
  const rows: [string, string | null | undefined][] = [
    ["Account Name", p.bank?.name],
    ["Bank", p.bank?.bankName],
    ["Account No.", p.bank?.account],
    ["IFSC", p.bank?.ifsc],
    ["UPI ID", p.upiId],
  ];
  return (
    <View wrap={false} style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: accent, borderRadius: 0, backgroundColor: soft, padding: z(7) }}>
      <View style={{ flexGrow: 1, flexShrink: 1, paddingRight: z(8) }}>
        <Text style={{ fontFamily: FONT.bold, fontSize: z(10), color: accent, marginBottom: z(3) }}>Payment Details</Text>
        {rows
          .filter(([, v]) => !!v)
          .map(([label, v]) => (
            <View key={label} style={{ flexDirection: "row", marginBottom: z(1.5) }}>
              <Text style={{ width: z(66), fontFamily: FONT.medium, fontSize: z(9), color: INK }}>{label}</Text>
              <Text style={{ flexShrink: 1, flexGrow: 1, fontSize: z(9), color: MUTED }}>{v}</Text>
            </View>
          ))}
        <Text style={{ fontSize: z(8), color: MUTED, marginTop: z(2), lineHeight: 1.3 }}>Please share the payment screenshot on WhatsApp after paying.</Text>
      </View>
      {p.qrDataUrl ? (
        // Fixed-width QR column (2026-10-26): the instruction lines word-wrap under the code and can never push it out of the box.
        <View style={{ width: 104, flexShrink: 0, alignItems: "center" }}>
          {/* Fixed 84 pt (≈3 cm) whatever the page scale, on a white quiet zone — scannable from print and screen. */}
          <Image src={p.qrDataUrl} style={{ width: 84, height: 84, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 0, padding: 3 }} />
          <Text style={{ width: 104, fontFamily: FONT.bold, fontSize: z(8.5), color: accent, marginTop: z(2), textAlign: "center" }}>
            Scan & Pay{p.amount ? ` ${inr(p.amount)}` : ""}
          </Text>
          <Text style={{ width: 104, fontSize: z(7), color: MUTED, textAlign: "center", lineHeight: 1.25 }}>GPay · PhonePe · Paytm · BHIM or any UPI app — amount fills in automatically</Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------- Corporate footer ----------
export type BrandFooterProps = {
  phones: string[];
  email: string;
  website: string;
  address: string;
  accent?: string;
  soft?: string;
  k?: number;
};
const withScheme = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
export function BrandFooter(p: BrandFooterProps) {
  const k = p.k ?? 1;
  const accent = p.accent ?? BRAND_BLUE;
  const soft = p.soft ?? SOFT;
  const z = (n: number) => Math.round(n * k * 10) / 10;
  const item = { flexDirection: "row" as const, alignItems: "center" as const, marginHorizontal: z(6), marginVertical: z(1.2), textDecoration: "none" as const };
  const txt = { fontSize: z(8.4), color: INK, marginLeft: z(3) };
  const social = { ...item, marginHorizontal: z(8) };
  const socTxt = { fontFamily: FONT.medium, fontSize: z(8.4), color: accent, marginLeft: z(3) };
  const tel = p.phones[0]?.replace(/\D/g, "");
  return (
    <View wrap={false}>
      <View style={{ backgroundColor: accent, paddingVertical: z(6), paddingHorizontal: z(8) }}>
        <Text style={{ color: "#ffffff", fontFamily: FONT.bold, fontSize: z(7.6), textAlign: "center", letterSpacing: 0.3 }}>{FOOTER_CATEGORIES.join("   •   ")}</Text>
      </View>
      <View style={{ backgroundColor: soft, paddingVertical: z(5), paddingHorizontal: z(8) }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
          <Link src={tel ? `tel:+91${tel.slice(-10)}` : "#"} style={item}><BrandIcon name="phone" size={z(9)} color={accent} /><Text style={txt}>{p.phones.join("  |  ")}</Text></Link>
          <Link src={`mailto:${p.email}`} style={item}><BrandIcon name="mail" size={z(9)} color={accent} /><Text style={txt}>{p.email}</Text></Link>
          <Link src={withScheme(p.website)} style={item}><BrandIcon name="globe" size={z(9)} color={accent} /><Text style={txt}>{p.website.replace(/^https?:\/\//i, "")}</Text></Link>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: z(1.5) }}>
          <Link src={`https://maps.google.com/?q=${encodeURIComponent(p.address)}`} style={item}><BrandIcon name="pin" size={z(9)} color={accent} /><Text style={txt}>{p.address}</Text></Link>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: z(3) }}>
          <Link src={SOCIAL_LINKS.instagram} style={social}><BrandIcon name="instagram" size={z(10)} color={accent} /><Text style={socTxt}>Instagram</Text></Link>
          <Link src={SOCIAL_LINKS.facebook} style={social}><BrandIcon name="facebook" size={z(10)} color={accent} /><Text style={socTxt}>Facebook</Text></Link>
          <Link src={SOCIAL_LINKS.youtube} style={social}><BrandIcon name="youtube" size={z(10)} color={accent} /><Text style={socTxt}>YouTube</Text></Link>
          <Link src={SOCIAL_LINKS.google} style={social}><BrandIcon name="google" size={z(10)} color={accent} /><Text style={socTxt}>Google Review</Text></Link>
        </View>
      </View>
    </View>
  );
}

/** "Authorised Signatory" stamp box (company seal / signature space). */
export function SignatoryBox({ company, stampDataUrl, accent = BRAND_BLUE, k = 1 }: { company: string; stampDataUrl?: string | null; accent?: string; k?: number }) {
  const z = (n: number) => Math.round(n * k * 10) / 10;
  return (
    <View wrap={false} style={{ width: z(170), height: z(stampDataUrl ? 86 : 62), borderWidth: 1, borderColor: accent, borderRadius: 0, justifyContent: "space-between", alignItems: "center", paddingTop: z(4), paddingBottom: z(4) }}>
      <Text style={{ fontSize: z(6.8), color: MUTED }}>For {company.toUpperCase()}</Text>
      {/* Company seal (public/stamp.png, transparent PNG); falls back to the plain text hint when the file is missing. */}
      {stampDataUrl ? <Image src={stampDataUrl} style={{ width: z(52), height: z(52), objectFit: "contain" }} /> : <Text style={{ fontSize: z(6), color: "#94a3b8" }}>(Company Stamp & Signature)</Text>}
      <Text style={{ fontFamily: FONT.bold, fontSize: z(8), color: INK }}>Authorised Signatory</Text>
    </View>
  );
}
