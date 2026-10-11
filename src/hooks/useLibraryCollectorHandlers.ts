import { StackActions } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useStore } from "../state/useStore";
import { addLibraryCollectorPicks } from "../state/libraryCollectorActions";
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

/** The collections visited during a session were visited FOR the session: once
 *  it ends, the workspace stack rests on its hub again, so the next trip into
 *  the workspace doesn't land on a page the picker left open. */
function popWorkspaceStackToHub(navigation: any) {
  let current = navigation;
  while (current) {
    const state = current.getState?.();
    const routeNames = state?.routeNames;
    if (Array.isArray(routeNames) && routeNames.includes("Browse")) {
      if ((state?.routes?.length ?? 0) > 1) current.dispatch(StackActions.popToTop());
      return;
    }
    current = current.getParent?.();
  }
}

/**
 * The picker footer's two verbs while a compilation is collecting
 * (`libraryCollector`), shared by every page that shows it (hub + collection).
 *
 * Both verbs END the session and return to the compilation that started it —
 * Add commits the basket first, ✕ keeps nothing. The session is a detour from
 * the compilation; every exit lands back on it (founder, 2026-10-11: ✕ used to
 * leave you standing in the collection you were browsing).
 */
export function useLibraryCollectorHandlers(navigation: any) {
  const { t } = useTranslation();

  const returnToCompilation = (kind: string, targetId: string) => {
    popWorkspaceStackToHub(navigation);
    navigateToAncestorRoute(navigation, "LibraryHome", {
      openCollectionKind: kind,
      openCollectionId: targetId,
      openToken: Date.now(),
    });
  };

  const onAdd = () => {
    const state = useStore.getState();
    const collector = state.libraryCollector;
    if (!collector || collector.picks.length === 0) return;
    const result = addLibraryCollectorPicks();
    if (result.noCharts) {
      // haptics vocabulary: `error` — a failure (nothing could be added).
      haptic.error();
      AppAlert.info(t("selection.noCharts"), t("selection.noChartsBody"));
      return;
    }
    const { kind, targetId } = collector;
    state.cancelLibraryCollecting();
    // haptics vocabulary: `success` — a meaningful completion, paired with a toast.
    haptic.success();
    toast(t("selection.addedCount", { count: result.added }), "checkmark-circle-outline");
    returnToCompilation(kind, targetId);
  };

  const onCancel = () => {
    const state = useStore.getState();
    const collector = state.libraryCollector;
    if (!collector) return;
    const { kind, targetId } = collector;
    state.cancelLibraryCollecting();
    returnToCompilation(kind, targetId);
  };

  return { onAdd, onCancel };
}
