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
  source?: "activity" | "detail";
};

function getRootNavigation(navigation: any) {
  let currentNavigation = navigation;
  while (currentNavigation?.getParent?.()) {
    currentNavigation = currentNavigation.getParent();
  }
  return currentNavigation;
}

export function openCollectionInBrowse(navigation: any, params: CollectionDetailRouteParams) {
  navigation.navigate("CollectionDetail", params);
}

export function openWorkspaceBrowseRoot(navigation: any) {
  const rootNavigation = getRootNavigation(navigation);
  rootNavigation?.navigate?.("Home", {
    screen: "WorkspaceStack",
    params: {
      screen: "Browse",
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
