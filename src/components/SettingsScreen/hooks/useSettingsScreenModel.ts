import { useEffect, useRef, useState } from "react";
import { useRoute } from "@react-navigation/native";
import type { SettingsView } from "../types";

export function useSettingsScreenModel() {
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
    view === "library"
      ? "Library & Backups"
      : view === "recording"
        ? "Recording"
        : view === "sharing"
          ? "Sharing"
        : view === "about"
          ? "About"
          : view === "export"
            ? "Export Archive"
            : view === "import"
              ? "Import Archive"
              : view === "storage"
                ? "Storage details"
                : "Settings";
  const showSubscreen = view !== "overview";
  // Recording, About, and Library are reached straight from the overview, so they return
  // there. Export / import / storage are reached FROM the library page, so back to library.
  const backView: SettingsView =
    view === "library" || view === "recording" || view === "sharing" || view === "about"
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
