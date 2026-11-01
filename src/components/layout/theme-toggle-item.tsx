"use client";

import { useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { readTheme, saveTheme, type ThemeChoice } from "@/lib/theme";

const NEXT: Record<ThemeChoice, ThemeChoice> = { light: "dark", dark: "system", system: "light" };
const LABEL: Record<ThemeChoice, string> = { light: "Light", dark: "Dark", system: "Auto" };

/** Topbar account-menu item: cycles Light → Dark → Auto (follows the phone/PC setting). Menu stays open. */
export function ThemeToggleItem() {
  const [choice, setChoice] = useState<ThemeChoice>(() => (typeof window === "undefined" ? "system" : readTheme()));
  const Icon = choice === "dark" ? Moon : choice === "light" ? Sun : Monitor;
  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        const next = NEXT[choice];
        saveTheme(next);
        setChoice(next);
      }}
    >
      <Icon /> Theme: {LABEL[choice]}
    </DropdownMenuItem>
  );
}
