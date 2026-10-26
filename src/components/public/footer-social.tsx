import { FaFacebookF, FaInstagram, FaLinkedinIn, FaYoutube } from "react-icons/fa6";
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
export async function FooterSocial({ className = "flex items-center gap-2", iconClass = "flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white hover:text-[#0a2540]" }: { className?: string; iconClass?: string }) {
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
    </div>
  );
}
