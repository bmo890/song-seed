import { i18n } from "./instance";

/** The date/number locale outside React (domain and services): the same mapping
 *  LocaleProvider uses, read from the live i18n language. Kept apart from locale.tsx
 *  so domain code doesn't pull in storage and native modules. */
export function currentFormatLocale(): "en-US" | "he-IL" {
  return i18n.language === "he" ? "he-IL" : "en-US";
}
