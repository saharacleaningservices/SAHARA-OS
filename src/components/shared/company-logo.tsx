import { cn } from "@/lib/utils";

/** Sahara Cleaning Services wordmark — the uploaded logo if set, else the bundled default. */
export const DEFAULT_LOGO_URL = "/uploads/logo/sahara-logo.svg";

export function CompanyLogo({
  logoUrl,
  className,
  alt = "Sahara Cleaning Services",
}: {
  logoUrl?: string | null;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={logoUrl || DEFAULT_LOGO_URL}
      alt={alt}
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}
