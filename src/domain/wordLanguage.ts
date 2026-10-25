import { isAppLanguage, type AppLanguage } from "../i18n/languages";

/**
 * Which language the word tools work in: the Word Finder, Word Ladder's
 * suggestions and Borrowed Words' default source (founder, 2026-10-25: Latin
 * letters can't say whether "once" is English or Spanish, so follow the app
 * language, with a Settings choice to override). Hebrew letters still route to
 * Hebrew on their own, whatever is chosen.
 */
export type WordLanguagePref = "auto" | AppLanguage;

/** The languages the word tools are built for; a new UI language joins once
 *  its word lists and lookups exist. */
export const WORD_TOOL_LANGUAGES: AppLanguage[] = ["en", "he", "es"];

export function sanitizeWordLanguagePref(value: unknown): WordLanguagePref {
  return isAppLanguage(value) && WORD_TOOL_LANGUAGES.includes(value) ? value : "auto";
}

/** The language the word tools use: the choice, or the app language on Auto
 *  (English when the app speaks a language the tools don't). */
export function resolveWordLanguage(pref: WordLanguagePref, appLanguage: string): AppLanguage {
  if (pref !== "auto") return pref;
  return isAppLanguage(appLanguage) && WORD_TOOL_LANGUAGES.includes(appLanguage) ? appLanguage : "en";
}
