import type { AppLanguage } from "./languages";
import { en } from "./locales/en";
import { he } from "./locales/he";
import { es } from "./locales/es";
import { de } from "./locales/de";
import { pt } from "./locales/pt";

/**
 * Every language's catalog, one file each under locales/. A language listed in
 * languages.ts without a catalog here fails the type check; a catalog missing
 * keys fails translations.test.ts.
 */
export const resources = {
  en: { translation: en },
  he: { translation: he },
  es: { translation: es },
  de: { translation: de },
  pt: { translation: pt },
} as const satisfies Record<AppLanguage, { translation: object }>;
