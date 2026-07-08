import { useStore } from "./state/useStore";

export type CollectionDetailRouteParams = {
  collectionId: string;
  workspaceId?: string;
  activityRangeStartTs?: number;
  activityRangeEndTs?: number;
  activityMetricFilter?: "created" | "updated" | "both";
  activityLabel?: string;
  focusIdeaId?: string;
  focusToken?: number;
  showBack?: boolean;
  source?: "activity" | "detail" | "search";
  /** Origin this collection was opened from (e.g. "Activity", "Revisit"). When
   * set, the collection is a contextual jump: back returns to that origin and
   * the back button is labelled with it. */
  backLabel?: string;
};

export function getRootNavigation(navigation: any) {
  let currentNavigation = navigation;
  while (currentNavigation?.getParent?.()) {
    currentNavigation = currentNavigation.getParent();
  }
  return currentNavigation;
}

export function openCollectionInBrowse(navigation: any, params: CollectionDetailRouteParams) {
  navigation.navigate("CollectionDetail", params);
}

export function openWorkspaceBrowseRoot(navigation: any, workspaceId?: string) {
  const rootNavigation = getRootNavigation(navigation);
  rootNavigation?.navigate?.("Home", {
    screen: "WorkspaceStack",
    params: {
      screen: "Browse",
      params: workspaceId ? { workspaceId } : undefined,
    },
  });
}

export function openCollectionAsBrowseRoot(navigation: any, params: CollectionDetailRouteParams) {
  const rootNavigation = getRootNavigation(navigation);
  rootNavigation?.navigate?.("Home", {
    screen: "WorkspaceStack",
    params: {
      screen: "CollectionDetail",
      params,
    },
  });
}

/**
 * Jump to a clip/song's HOME — its collection, scrolled to and highlighting the
 * card (the same treatment as "view in collection" from Search/Activity). Used
 * by the queue's per-row arrow. Falls back to the idea's own detail page if it
 * isn't filed in a collection.
 */
export function openIdeaInCollection(navigation: any, ideaId: string) {
  const state = useStore.getState();
  const workspace = state.workspaces.find((ws) => ws.ideas.some((idea) => idea.id === ideaId));
  const idea = workspace?.ideas.find((candidate) => candidate.id === ideaId);
  if (workspace && idea?.collectionId) {
    openCollectionAsBrowseRoot(navigation, {
      collectionId: idea.collectionId,
      workspaceId: workspace.id,
      focusIdeaId: ideaId,
      focusToken: Date.now(),
    });
    return;
  }
  const rootNavigation = getRootNavigation(navigation);
  (rootNavigation ?? navigation)?.navigate?.("IdeaDetail", { ideaId });
}

export function openCollectionFromContext(navigation: any, params: CollectionDetailRouteParams) {
  const rootNavigation = getRootNavigation(navigation);
  const contextualParams = {
    ...params,
    showBack: true,
  };

  if (typeof rootNavigation?.push === "function") {
    rootNavigation.push("Home", {
      screen: "WorkspaceStack",
      params: {
        screen: "CollectionDetail",
        params: contextualParams,
      },
    });
    return;
  }

  rootNavigation?.navigate?.("Home", {
    screen: "WorkspaceStack",
    params: {
      screen: "CollectionDetail",
      params: contextualParams,
    },
  });
}

export function goBackFromParentStack(navigation: any) {
  let currentNavigation = navigation;

  while (currentNavigation) {
    if (typeof currentNavigation.canGoBack === "function" && currentNavigation.canGoBack()) {
      currentNavigation.goBack();
      return true;
    }
    currentNavigation = currentNavigation.getParent?.();
  }

  return false;
}
