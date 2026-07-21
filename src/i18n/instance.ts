import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./translations";

void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "he"],
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };
