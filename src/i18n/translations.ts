import type { AppLanguage } from "./languages";
import { en } from "./locales/en";
import { he } from "./locales/he";
import { es } from "./locales/es";

/**
 * Every language's catalog, one file each under locales/. A language listed in
 * languages.ts without a catalog here fails the type check; a catalog missing
 * keys fails translations.test.ts.
 */
export const resources = {
  en: { translation: en },
  he: { translation: he },
  es: { translation: es },
} as const satisfies Record<AppLanguage, { translation: object }>;
