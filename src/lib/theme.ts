// CRM light/dark theme. The `.dark` palette already lives in globals.css; this only toggles the class on <html>.
// Choice is kept per browser in localStorage ("light" | "dark" | "system"). CRM shell only — public pages stay light.
export type ThemeChoice = "light" | "dark" | "system";
export const THEME_KEY = "sahara_theme";

/** Inline script (runs before first paint inside the CRM layout) — avoids a light flash for dark users. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||((t===null||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}`;

export function readTheme(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function saveTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
  } catch {}
  applyTheme(choice);
}
