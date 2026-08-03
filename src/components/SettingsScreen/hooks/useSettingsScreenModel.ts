import { useEffect, useRef, useState } from "react";
import { useRoute } from "@react-navigation/native";
import type { SettingsView } from "../types";
import { useTranslation } from "react-i18next";

export function useSettingsScreenModel() {
  const { t } = useTranslation();
  const [view, setView] = useState<SettingsView>("overview");
  const route = useRoute<any>();
  // Deep-link from outside (e.g. the backup reminder dialog's "Backup Settings"
  // button): jump straight to a subview instead of always landing on the overview.
  // openToken guards re-application — navigating here twice with the same target
  // view must still re-apply it (the user may have since tapped elsewhere).
  const handledOpenTokenRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const routeInitialView = route.params?.initialView as SettingsView | undefined;
    const routeOpenToken = route.params?.openToken as number | undefined;
    if (
      !routeInitialView ||
      typeof routeOpenToken !== "number" ||
      handledOpenTokenRef.current === routeOpenToken
    ) {
      return;
    }
    handledOpenTokenRef.current = routeOpenToken;
    setView(routeInitialView);
  }, [route.params?.initialView, route.params?.openToken]);

  // Accessibility label for the header; the visible serif title comes from each
  // view's PageIntro (the header itself stays untitled to avoid doubled titles).
  const title =
    view === "account"
      ? t("settings.account")
      : view === "general"
        ? t("settings.general")
        : view === "library"
          ? t("settingsLibrary.title")
          : view === "recording"
            ? t("settings.recordingAudio")
            : view === "sharing"
              ? t("sharing.title")
              : view === "about"
                ? t("settings.helpAbout")
                : view === "export"
                  ? t("settingsLibrary.exportArchive")
                  : view === "import"
                    ? t("settingsLibrary.importArchive")
                    : view === "storage"
                      ? t("settingsLibrary.storageDetails")
                      : t("settings.title");
  const showSubscreen = view !== "overview";
  // Top-level destinations return to the overview. Export / import / storage are
  // reached from Data & storage, so their back path returns there first.
  const backView: SettingsView =
    view === "account" ||
    view === "general" ||
    view === "library" ||
    view === "recording" ||
    view === "sharing" ||
    view === "about"
      ? "overview"
      : "library";

  return {
    view,
    setView,
    title,
    showSubscreen,
    backView,
  };
}
