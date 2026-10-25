import type { AppLanguage } from "./locale";

/**
 * The languages the app speaks, as the welcome screen and Settings → Preferences both
 * offer them (founder, 2026-10-25: one list, a flag beside each). Each name is written
 * in its own script so someone lost in the wrong language can still find theirs.
 * Adding a language here adds it to both pickers.
 */
export const APP_LANGUAGES: ReadonlyArray<{ code: AppLanguage; nativeName: string; flag: string }> = [
  { code: "en", nativeName: "English", flag: "🇺🇸" },
  { code: "he", nativeName: "עברית", flag: "🇮🇱" },
];

/** "🇺🇸  English": the flag and the language's own name, as both pickers print it. */
export function languageLabel(code: AppLanguage): string {
  const language = APP_LANGUAGES.find((entry) => entry.code === code);
  return language ? `${language.flag}  ${language.nativeName}` : code;
}
