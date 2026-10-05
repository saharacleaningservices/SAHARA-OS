"use client";

import { useRouter } from "next/navigation";
import { LANGS, LANG_COOKIE, type Lang } from "@/lib/staff-i18n";
import { cn } from "@/lib/utils";

/** 🇬🇧 English | 🇮🇳 हिंदी | 🇮🇳 मराठी — saved on this phone. */
export function LanguageSwitcher({ lang }: { lang: Lang }) {
  const router = useRouter();
  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1" role="radiogroup" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={lang === l.code}
          onClick={() => {
            document.cookie = `${LANG_COOKIE}=${l.code}; path=/; max-age=31536000; samesite=lax`;
            router.refresh();
          }}
          className={cn(
            "flex min-h-11 items-center justify-center gap-1 rounded-xl text-sm font-semibold transition",
            lang === l.code ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
          )}
        >
          <span aria-hidden>{l.flag}</span> {l.label}
        </button>
      ))}
    </div>
  );
}
