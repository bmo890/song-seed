import { useTranslation } from "react-i18next";
import { useStore } from "../state/useStore";
import { addIdeasToLibraryCollector } from "../state/libraryCollectorActions";
import { AppAlert } from "../components/common/AppAlert";
import { toast } from "../components/common/toastStore";
import { haptic } from "../design/haptics";

/** Walks up the navigator tree to reach a route registered on an ancestor
 *  (the drawer's LibraryHome from inside the workspace stack). */
function navigateToAncestorRoute(navigation: any, routeName: string, params?: Record<string, unknown>) {
  let current = navigation;
  while (current) {
    const routeNames = current.getState?.()?.routeNames;
    if (Array.isArray(routeNames) && routeNames.includes(routeName)) {
      current.navigate(routeName, params);
      return true;
    }
    current = current.getParent?.();
  }
  return false;
}

/**
 * The picker footer's two verbs while a compilation is collecting (`libraryCollector`),
 * shared by every page that shows it (hub + collection).
 *
 * Add = "I'm done picking": whatever is selected on this page is added, then the
 * compilation that started the session reopens. ✕ ends collecting in place and
 * keeps nothing.
 */
export function useLibraryCollectorHandlers(navigation: any) {
  const { t } = useTranslation();
  const onAdd = () => {
    const state = useStore.getState();
    const collector = state.libraryCollector;
    if (!collector) return;
    const pending = state.selectedListIdeaIds;
    if (pending.length === 0) return;
    const result = addIdeasToLibraryCollector(pending);
    if (result.noCharts) {
      // haptics vocabulary: `error` — a failure (nothing could be added).
      haptic.error();
      AppAlert.info(t("selection.noCharts"), t("selection.noChartsBody"));
      return;
    }
    state.cancelListSelection();
    const { kind, targetId } = collector;
    state.cancelLibraryCollecting();
    // haptics vocabulary: `success` — a meaningful completion, paired with a toast.
    haptic.success();
    toast(t("selection.addedCount", { count: result.added }), "checkmark-circle-outline");
    navigateToAncestorRoute(navigation, "LibraryHome", {
      openCollectionKind: kind,
      openCollectionId: targetId,
      openToken: Date.now(),
    });
  };
  const onCancel = () => {
    const state = useStore.getState();
    state.cancelListSelection();
    state.cancelLibraryCollecting();
  };
  return { onAdd, onCancel };
}
