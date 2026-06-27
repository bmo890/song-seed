import { useState } from "react";
import type { SettingsView } from "../types";

export function useSettingsScreenModel() {
  const [view, setView] = useState<SettingsView>("overview");

  const title =
    view === "export"
      ? "Export Library"
      : view === "import"
        ? "Import Archive"
        : view === "storage"
          ? "Storage details"
          : "Settings";
  const showSubscreen = view !== "overview";

  return {
    view,
    setView,
    title,
    showSubscreen,
  };
}
