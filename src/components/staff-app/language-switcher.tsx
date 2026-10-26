"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { LANGS, type Lang } from "@/lib/staff-i18n";
import { setMyLanguage } from "@/server/actions/staff-self";

/** Compact "🌐 English ▾" dropdown — saved on this phone and on the staff record. */
export function LanguageSwitcher({ lang, label = "Language" }: { lang: Lang; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="relative flex min-h-10 items-center gap-1 rounded-full border border-border bg-card pl-2.5 pr-1 text-sm font-medium">
      <Globe className="size-4 text-primary" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        value={lang}
        disabled={pending}
        aria-label={label}
        onChange={(e) => {
          const v = e.target.value;
          start(async () => {
            await setMyLanguage(v);
            router.refresh();
          });
        }}
        className="h-9 appearance-none bg-transparent pr-5 text-sm font-semibold outline-none"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 text-xs text-muted-foreground" aria-hidden>
        ▾
      </span>
    </label>
  );
}
