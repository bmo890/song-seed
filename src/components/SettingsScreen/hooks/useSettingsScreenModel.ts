import { useMemo, useState } from "react";
import type { AppBreadcrumbItem } from "../../common/AppBreadcrumbs";
import type { SettingsView } from "../types";

export function useSettingsScreenModel() {
  const [view, setView] = useState<SettingsView>("overview");

  const title =
    view === "export" ? "Export Library" : view === "storage" ? "Storage details" : "Settings";
  const showSubscreen = view !== "overview";
  const breadcrumbItems = useMemo<AppBreadcrumbItem[]>(
    () =>
      view === "storage"
        ? [
            { key: "settings", label: "Settings", level: "settings" },
            { key: "storage-details", label: "Storage details", level: "settings", active: true },
          ]
        : [{ key: "settings", label: "Settings", level: "settings", active: true }],
    [view]
  );

  return {
    view,
    setView,
    title,
    showSubscreen,
    breadcrumbItems,
  };
}
