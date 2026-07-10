import { useState } from "react";
import type { SettingsView } from "../types";

export function useSettingsScreenModel() {
  const [view, setView] = useState<SettingsView>("overview");

  // Accessibility label for the header; the visible serif title comes from each
  // view's PageIntro (the header itself stays untitled to avoid doubled titles).
  const title =
    view === "library"
      ? "Library & Backups"
      : view === "recording"
        ? "Recording"
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
    view === "library" || view === "recording" || view === "about" ? "overview" : "library";

  return {
    view,
    setView,
    title,
    showSubscreen,
    backView,
  };
}
