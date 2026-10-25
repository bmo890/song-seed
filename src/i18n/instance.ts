import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./translations";
import { APP_LANGUAGE_CODES, DEFAULT_LANGUAGE } from "./languages";

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: APP_LANGUAGE_CODES,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };
