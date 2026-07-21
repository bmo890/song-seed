import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import * as Updates from "expo-updates";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DevSettings, I18nManager, Platform } from "react-native";
import { i18n } from "./instance";

export type AppLanguage = "en" | "he";
export type UiDirection = "ltr" | "rtl";

const LANGUAGE_KEY = "songnook-ui-language-v1";

type LocaleContextValue = {
  language: AppLanguage;
  formatLocale: "en-US" | "he-IL";
  direction: UiDirection;
  setLanguage: (language: AppLanguage) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "en" || value === "he";
}

function detectInitialLanguage(): AppLanguage {
  return getLocales()[0]?.languageCode === "he" ? "he" : "en";
}

export async function readOrCreateLanguage(): Promise<AppLanguage> {
  const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (isAppLanguage(stored)) return stored;
  const detected = detectInitialLanguage();
  await AsyncStorage.setItem(LANGUAGE_KEY, detected);
  return detected;
}

async function reloadApplication() {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.location.reload();
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch (error) {
    if (__DEV__) {
      DevSettings.reload();
      return;
    }
    throw error;
  }
}

async function applyNativeDirection(language: AppLanguage): Promise<boolean> {
  const shouldBeRtl = language === "he";
  if (Platform.OS === "web") {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
      document.documentElement.dir = shouldBeRtl ? "rtl" : "ltr";
    }
    return false;
  }
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(shouldBeRtl);
  return I18nManager.isRTL !== shouldBeRtl;
}

export function useLocaleBootstrap() {
  const [language, setLanguage] = useState<AppLanguage | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    void readOrCreateLanguage()
      .then(async (next) => {
        await i18n.changeLanguage(next);
        const needsReload = await applyNativeDirection(next);
        if (needsReload) {
          await reloadApplication();
          return;
        }
        if (active) setLanguage(next);
      })
      .catch((nextError) => {
        if (active) {
          setError(nextError);
          void i18n.changeLanguage("en");
          setLanguage("en");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { language, error };
}

export function LocaleProvider({ language, children }: { language: AppLanguage; children: React.ReactNode }) {
  const value = useMemo<LocaleContextValue>(() => ({
    language,
    formatLocale: language === "he" ? "he-IL" : "en-US",
    direction: language === "he" ? "rtl" : "ltr",
    setLanguage: async (next) => {
      if (next === language) return;
      await AsyncStorage.setItem(LANGUAGE_KEY, next);
      await i18n.changeLanguage(next);
      await applyNativeDirection(next);
      await reloadApplication();
    },
  }), [language]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}
