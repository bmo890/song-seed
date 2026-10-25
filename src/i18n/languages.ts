/**
 * The languages the app speaks: the one list everything else reads (founder,
 * 2026-10-25: more languages are coming). The welcome picker and Settings show
 * it, i18n registers it, the date/number locale and the layout direction come
 * from it, and the phone's language is matched against it on first launch.
 *
 * Adding a language:
 *   1. add its entry here;
 *   2. add `locales/<code>.ts`, a full copy of `locales/en.ts` translated, and
 *      list it in `translations.ts` (the type check fails until you do; the
 *      parity test fails until every key is there);
 *   3. Latin-script languages (Spanish, French, German…) need nothing more:
 *      Lora and Plus Jakarta Sans cover them. Another script needs its own
 *      faces: App.tsx swaps in the Hebrew ones whenever the direction is RTL,
 *      so that swap must become per-language before Arabic or Cyrillic lands.
 * Language-specific content is separate and falls back to English until it is
 * built: the word finder, name ideas (utils.ts NAME_IDEA_LANGUAGES), default clip
 * titles (domain/titleNaming.ts), Magpie sources and the word ladder lists.
 *
 * Each name is written in its own script, so someone lost in the wrong
 * language can still find theirs.
 */
export const APP_LANGUAGES = [
  { code: "en", nativeName: "English", flag: "🇺🇸", formatLocale: "en-US", direction: "ltr" },
  { code: "he", nativeName: "עברית", flag: "🇮🇱", formatLocale: "he-IL", direction: "rtl" },
  // Neutral Spanish (tú) that reads naturally in Spain and Latin America.
  { code: "es", nativeName: "Español", flag: "🇪🇸", formatLocale: "es-ES", direction: "ltr" },
  { code: "de", nativeName: "Deutsch", flag: "🇩🇪", formatLocale: "de-DE", direction: "ltr" },
  // Brazilian Portuguese (você).
  { code: "pt", nativeName: "Português", flag: "🇧🇷", formatLocale: "pt-BR", direction: "ltr" },
] as const;

type LanguageEntry = (typeof APP_LANGUAGES)[number];
export type AppLanguage = LanguageEntry["code"];
export type FormatLocale = LanguageEntry["formatLocale"];
export type UiDirection = "ltr" | "rtl";

export const DEFAULT_LANGUAGE: AppLanguage = "en";

export const APP_LANGUAGE_CODES: AppLanguage[] = APP_LANGUAGES.map((language) => language.code);

export function isAppLanguage(value: unknown): value is AppLanguage {
  return APP_LANGUAGES.some((language) => language.code === value);
}

function entryFor(code: string | undefined): LanguageEntry {
  return APP_LANGUAGES.find((language) => language.code === code) ?? APP_LANGUAGES[0];
}

/** "en-US", "he-IL": the locale dates and numbers are formatted in. */
export function formatLocaleFor(code: string | undefined): FormatLocale {
  return entryFor(code).formatLocale;
}

export function directionFor(code: string | undefined): UiDirection {
  return entryFor(code).direction;
}

/** The first of the phone's preferred languages the app speaks, else English. */
export function matchLanguage(preferredCodes: ReadonlyArray<string | null | undefined>): AppLanguage {
  return preferredCodes.find(isAppLanguage) ?? DEFAULT_LANGUAGE;
}

/** "🇺🇸  English": the flag and the language's own name, as both pickers print it. */
export function languageLabel(code: AppLanguage): string {
  const language = entryFor(code);
  return `${language.flag}  ${language.nativeName}`;
}
