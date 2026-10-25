import { useStore } from "../state/useStore";
import { useLocale, type AppLanguage } from "../i18n";
import { resolveWordLanguage } from "../domain/wordLanguage";

/** The language the word tools work in right now: Settings' choice, or the
 *  app language on Auto. */
export function useWordLanguage(): AppLanguage {
  const pref = useStore((state) => state.wordLanguage);
  const { language } = useLocale();
  return resolveWordLanguage(pref, language);
}
