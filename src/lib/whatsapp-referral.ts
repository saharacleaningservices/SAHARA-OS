// Click-to-WhatsApp ads (Meta): when someone taps "Send message" on a Facebook / Instagram ad, the first inbound
// WhatsApp message carries a `referral` object — which ad, which headline, where it ran. This turns that into a
// clean, bounded record and the lead-attribution fields the Marketing dashboard already reads, so a lead that
// came from a paid ad is tagged "Meta Ads" instead of "WhatsApp Direct".
//
// Meta documents: referral = { source_url, source_id, source_type: "ad" | "post", headline, body, media_type,
// image_url, video_url, thumbnail_url, ctwa_clid }. Everything here is untrusted input: strings are trimmed,
// stripped of control characters and length-capped; unknown shapes yield null (the message is then handled as an
// ordinary WhatsApp inquiry).

export type CtwaReferral = {
  sourceType: "ad" | "post";
  sourceId: string | null; // ad id (or post id)
  sourceUrl: string | null;
  headline: string | null;
  body: string | null;
  ctwaClid: string | null;
};

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return t || null;
};

export function parseCtwaReferral(raw: unknown): CtwaReferral | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sourceType = r.source_type === "post" ? "post" : r.source_type === "ad" ? "ad" : null;
  if (!sourceType) return null;
  const sourceId = clean(r.source_id, 64);
  const sourceUrl = clean(r.source_url, 300);
  // Must at least identify the ad; a bare { source_type } is not worth tagging.
  if (!sourceId && !sourceUrl) return null;
  return {
    sourceType,
    sourceId,
    sourceUrl: sourceUrl && /^https:\/\//i.test(sourceUrl) ? sourceUrl : null,
    headline: clean(r.headline, 120),
    body: clean(r.body, 200),
    ctwaClid: clean(r.ctwa_clid, 200),
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

/** Lead attribution columns for a lead created from a Click-to-WhatsApp ad. */
export function ctwaLeadFields(ref: CtwaReferral, at: Date = new Date()) {
  const network = ref.sourceUrl && /instagram\.com/i.test(ref.sourceUrl) ? "instagram" : "facebook";
  const campaign = (ref.headline && slug(ref.headline)) || (ref.sourceId ? `ad_${ref.sourceId}` : "click_to_whatsapp");
  return {
    acquisitionChannel: "Meta Ads", // the same channel name the Marketing dashboard groups paid Meta leads under
    utmSource: network,
    utmMedium: "click_to_whatsapp",
    utmCampaign: campaign,
    utmContent: ref.sourceId,
    firstTouchSource: "Meta Ads",
    firstTouchMedium: "click_to_whatsapp",
    firstTouchCampaign: campaign,
    firstTouchAt: at,
    latestTouchSource: "Meta Ads",
    latestTouchMedium: "click_to_whatsapp",
    latestTouchCampaign: campaign,
    latestTouchAt: at,
  };
}

/** One readable line for timelines / notes / alerts. */
export function describeCtwa(ref: CtwaReferral): string {
  const where = ref.sourceUrl && /instagram\.com/i.test(ref.sourceUrl) ? "Instagram" : "Facebook";
  return `Click-to-WhatsApp ${ref.sourceType === "post" ? "post" : "ad"} on ${where}${ref.headline ? ` — "${ref.headline}"` : ""}${ref.sourceId ? ` (id ${ref.sourceId})` : ""}`;
}
