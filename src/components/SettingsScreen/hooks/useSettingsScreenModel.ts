import { useState } from "react";
import type { SettingsView } from "../types";

export function useSettingsScreenModel() {
  const [view, setView] = useState<SettingsView>("overview");

  // Accessibility label for the header; the visible serif title comes from each
  // view's PageIntro (the header itself stays untitled to avoid doubled titles).
  const title =
    view === "library"
      ? "Library & Backups"
      : view === "export"
        ? "Export Archive"
        : view === "import"
          ? "Import Archive"
          : view === "storage"
            ? "Storage details"
            : "Settings";
  const showSubscreen = view !== "overview";
  // Export / import / storage are reached FROM the library page, so back returns there.
  const backView: SettingsView = view === "library" ? "overview" : "library";

  return {
    view,
    setView,
    title,
    showSubscreen,
    backView,
  };
}
