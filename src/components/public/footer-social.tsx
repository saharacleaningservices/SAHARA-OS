import { FaFacebookF, FaInstagram, FaLinkedinIn, FaWhatsapp, FaYoutube } from "react-icons/fa6";
import { waLink } from "@/lib/marketing-content";
import { BRANCHES } from "@/config/pune-seo-matrix";
import { socialLinks, type SocialKey } from "@/lib/social-links";
import { getCompanySettings } from "@/server/settings";

const ICON: Record<SocialKey, React.ComponentType<{ className?: string }>> = {
  facebook: FaFacebookF,
  instagram: FaInstagram,
  youtube: FaYoutube,
  linkedin: FaLinkedinIn,
};

/**
 * Social icons for every public footer — one source (lib/social-links.ts), UTM-tagged `utm_source=footer`.
 * LinkedIn appears automatically once its page link is saved in Settings. Server component: reads the setting itself.
 */
export async function FooterSocial({ className = "flex items-center gap-2", iconClass = "flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white hover:text-[#0a2540]", withWhatsApp = false }: { className?: string; iconClass?: string; /** Add a WhatsApp chat icon (main marketing line) after the profiles — site footer only. */ withWhatsApp?: boolean }) {
  const settings = await getCompanySettings().catch(() => null);
  return (
    <div className={className}>
      {socialLinks("footer", settings?.linkedinUrl).map((s) => {
        const Icon = ICON[s.key];
        return (
          <a key={s.key} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} className={iconClass}>
            <Icon className="size-4" />
          </a>
        );
      })}
      {withWhatsApp && (
        <a href={waLink("Hi Sahara, I'd like a quote.", BRANCHES.magarpatta.whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className={iconClass}>
          <FaWhatsapp className="size-4" />
        </a>
      )}
    </div>
  );
}
