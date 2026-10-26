import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";

// Service-campaign broadcasts (pest control, interior painting): which booking page the button opens and which
// banner is sent as the image header. Pure data + a pure recipient builder, so it is unit-tested without a session.
// Nothing is sent from here; sending goes through startBroadcast → sendWhatsAppTemplate, which keeps the
// consent guard, the STOP table and TEST mode.

export const SERVICE_OFFERS = {
  sahara_pest_control_offer: {
    page: "pest-control-pune",
    banner: "pest-control-offer-banner.jpg",
    defaultCampaign: "sahara_broadcast_pest_control_2026",
    label: "Pest control offer — image banner",
  },
  sahara_painting_offer: {
    page: "interior-painting-pune",
    banner: "painting-offer-banner.jpg",
    defaultCampaign: "sahara_broadcast_painting_2026",
    label: "Interior painting offer — free inspection",
  },
  // B2B (office / society / commercial AMC): still consent-only — send to business contacts who opted in, never cold lists.
  sahara_facility_management_offer: {
    page: "housekeeping-services",
    banner: "facility-management-offer-banner.jpg",
    defaultCampaign: "sahara_broadcast_facility_2026",
    label: "Facility management / housekeeping AMC (B2B)",
  },
} as const;

export type ServiceOfferTemplate = keyof typeof SERVICE_OFFERS;
export const isServiceOffer = (t: string): t is ServiceOfferTemplate => t in SERVICE_OFFERS;

/** The URL-button suffix: `page?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=<campaign>`. */
export const offerButtonParam = (page: string, campaign: string) => `${page}?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=${campaign}`;

/** One recipient for a service-offer template: first name as {{1}}, banner header, tagged booking page. */
export function serviceOfferRecipient(template: ServiceOfferTemplate, r: { mobile: string; name: string }, campaign: string) {
  const o = SERVICE_OFFERS[template];
  return {
    mobile: r.mobile,
    name: r.name,
    params: [r.name.split(/\s+/)[0] || "there"],
    buttonParam: offerButtonParam(o.page, campaign),
    headerImageUrl: `${PUBLIC_BOOKING_URL}/marketing/${o.banner}`,
  };
}
