"use client";

import { Globe } from "lucide-react";
import { CRM_LANGS, setCrmLang, useCrmLang, crmT, type CrmLang } from "@/lib/crm-i18n";

/** Compact EN / हिंदी / मराठी dropdown for the CRM header (all office roles). Saved in this browser's localStorage. */
export function CrmLanguageSwitcher() {
  const lang = useCrmLang();
  return (
    <label className="relative flex min-h-11 items-center gap-1 rounded-xl border border-border bg-card pl-2 pr-1 text-sm font-semibold md:min-h-9">
      <Globe className="size-4 text-primary" aria-hidden />
      <span className="sr-only">{crmT(lang, "Language")}</span>
      <select
        value={lang}
        aria-label={crmT(lang, "Language")}
        onChange={(e) => setCrmLang(e.target.value as CrmLang)}
        className="h-9 appearance-none bg-transparent pr-4 text-xs font-bold outline-none"
      >
        {CRM_LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.short} · {l.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1.5 text-[10px] text-muted-foreground" aria-hidden>▾</span>
    </label>
  );
}
