import { CommonActions, StackActions, type NavigatorScreenParams } from "@react-navigation/native";
import { useStore } from "./state/useStore";
import type { SettingsView } from "./components/SettingsScreen/types";

/**
 * SongNook navigation law (2026-09-16):
 *
 *   Back follows history. Up follows hierarchy. Never label one as the other.
 *   One Home, ever.
 *
 * - The root stack holds ONE `Home` (the drawer) at the bottom. Everything else on
 *   the root is a pushed page whose back pops to wherever it was opened from.
 * - "View in collection" from Activity / Search / Shelf / Revisit is a VISIT: the
 *   collection is pushed on the root (`CollectionVisit`), labelled with its origin.
 *   It never pushes a second Home.
 * - Anything that wants to land in the drawer world goes through `returnHome`,
 *   which POPS to the existing Home (React Navigation 7's `navigate` would push a
 *   duplicate Home instead — see StackRouter NAVIGATE without `pop`).
 * - Inside the workspace stack, "up" to the hub pops to Browse when it is beneath
 *   and pushes it once when it is not, so the stack never grows Collection, Browse,
 *   Collection, Browse…
 */

export type CollectionDetailRouteParams = {
  collectionId: string;
  workspaceId?: string;
  activityRangeStartTs?: number;
  activityRangeEndTs?: number;
  activityMetricFilter?: "created" | "updated" | "both";
  activityLabel?: string;
  focusIdeaId?: string;
  focusToken?: number;
};

export type HomeDrawerParamList = {
  Workspaces: undefined;
  WorkspaceStack: NavigatorScreenParams<WorkspaceStackParamList> | undefined;
  SearchHome: undefined;
  RevisitHome: undefined;
  ShelfHome: undefined;
  ReceivedHome: undefined;
  ActivityHome: undefined;
  TunerHome: undefined;
  MetronomeHome: undefined;
  LibraryHome:
    | {
        /** Collector-return / import deep link: which tab + entity to open. */
        openCollectionKind?: "playlist" | "songbook" | "setlist";
        openCollectionId?: string;
        openToken?: number;
      }
    | undefined;
  // openToken forces re-application when navigating to the SAME view twice in a row
  // (e.g. the backup reminder always deep-links to "library" — without a changing
  // token, a second dismiss+reopen wouldn't re-trigger the route-params effect).
  SettingsHome: { initialView?: SettingsView; openToken?: number } | undefined;
  // Two rooms, one screen component: NotepadHome is the Lyric Pad (notes only),
  // SparkHome is the Lyric Spark page (the three word tools + saved sparks).
  // The route name fixes the mode — there is no tab switch anymore.
  NotepadHome: { noteId?: string; openToken?: number } | undefined;
  SparkHome: { openToken?: number } | undefined;
  WordLadderHome: { exerciseId?: string } | undefined;
  CutUpHome: { sparkId?: string } | undefined;
  MagpieHome: { sparkId?: string } | undefined;
};

export type WorkspaceStackParamList = {
  Browse: { workspaceId?: string } | undefined;
  CollectionDetail: CollectionDetailRouteParams | undefined;
};

export type RootStackParamList = {
  Home: NavigatorScreenParams<HomeDrawerParamList> | undefined;
  IdeaDetail:
    | {
        ideaId?: string;
        startInEdit?: boolean;
        /** Land on a specific sketch tab (the player's door CTAs use this). */
        initialSongTab?: "takes" | "lyrics" | "chart" | "notes";
      }
    | undefined;
  /** A collection opened as a VISIT from somewhere outside the workspace stack
   *  (Activity, Search, Shelf, Revisit, the player queue). Back returns to that
   *  origin; the page is labelled with it. Same screen component as
   *  `CollectionDetail`. */
  CollectionVisit: CollectionDetailRouteParams;
  Activity: { workspaceId?: string; collectionId?: string } | undefined;
  Recording: undefined;
  BluetoothCalibration: undefined;
  ShareImport: undefined;
  Editor: { ideaId: string; clipId: string; audioUri?: string; durationMs?: number };
  Lyrics: { ideaId: string };
  LyricsVersion: { ideaId: string; versionId?: string; startInEdit?: boolean; forceNewVersion?: boolean; createDraft?: boolean };
  ChordSheet: { ideaId: string };
  ClipLineage: { ideaId: string; rootClipId: string };
  SongbookReader: { songbookId: string; startIdeaId?: string };
  SetlistSong: { setlistId: string; entryId: string };
  TransferReceive: { transferId: string };
};

/** Nested params for `Home` that open a screen inside the drawer. */
export type HomeNestedParams = NavigatorScreenParams<HomeDrawerParamList>;

export function getRootNavigation(navigation: any) {
  let currentNavigation = navigation;
  while (currentNavigation?.getParent?.()) {
    currentNavigation = currentNavigation.getParent();
  }
  return currentNavigation;
}

/** The focused leaf of a (possibly nested) navigation state. Falls back to the
 *  `screen`/`params` nesting convention when a child navigator has not rendered
 *  its own state yet. */
export function getDeepestRoute(
  state: any
): { name: string; params?: Record<string, unknown> } {
  if (!state?.routes?.length) return { name: "Home" };
  const route = state.routes[state.index ?? 0];
  return getDeepestRouteOf(route);
}

export function getDeepestRouteOf(route: any): { name: string; params?: Record<string, unknown> } {
  if (!route) return { name: "Home" };
  if (route.state) return getDeepestRoute(route.state);
  let current = route;
  while (typeof current?.params?.screen === "string") {
    current = { name: current.params.screen, params: current.params.params };
  }
  return { name: current?.name ?? "Home", params: current?.params };
}

function currentRootRoute(root: any): any {
  const state = root?.getState?.();
  if (!state?.routes?.length) return null;
  return state.routes[state.index ?? 0] ?? null;
}

/**
 * Land in the drawer world. POPS the root stack to the one Home (never pushes a
 * second one) and, when given nested params, opens that drawer screen. From a
 * screen that already sits inside Home this only applies the nested params.
 */
export function returnHome(navigation: any, nested?: HomeNestedParams) {
  const root = getRootNavigation(navigation);
  if (!root?.dispatch) return;
  root.dispatch(StackActions.popTo("Home", nested));
}

export function openCollectionInBrowse(navigation: any, params: CollectionDetailRouteParams) {
  // Inside the workspace stack this is a real forward PUSH (a child collection
  // sits above its parent, so back returns to the parent — RN7's `navigate`
  // would swap the current collection's params in place instead). From a
  // visited collection (root level) a child collection is one more visit.
  const routeNames: string[] = navigation?.getState?.()?.routeNames ?? [];
  if (routeNames.includes("CollectionDetail")) {
    navigation.dispatch(StackActions.push("CollectionDetail", params));
    return;
  }
  visitCollection(navigation, params);
}

/**
 * "Up" to a collection's parent collection. When the parent is already beneath
 * this screen in the same stack, pop back to it (its scroll and state intact);
 * otherwise open it in place.
 */
export function openParentCollection(navigation: any, params: CollectionDetailRouteParams) {
  const state = navigation?.getState?.();
  if (state?.routes?.length) {
    const index = state.index ?? state.routes.length - 1;
    for (let i = index - 1; i >= 0; i--) {
      const candidate = state.routes[i];
      if (isCollectionRoute(candidate) && candidate?.params?.collectionId === params.collectionId) {
        navigation.dispatch(StackActions.pop(index - i));
        return;
      }
    }
    // Up never goes deeper: with no parent beneath (deep link, restored state),
    // the parent takes this page's place instead of stacking on it.
    const current = state.routes[index];
    if (isCollectionRoute(current)) {
      navigation.dispatch(StackActions.replace(current.name, params));
      return;
    }
  }
  openCollectionInBrowse(navigation, params);
}

function isCollectionRoute(route: any): boolean {
  return route?.name === "CollectionDetail" || route?.name === "CollectionVisit";
}

/** "Up" to the workspace hub (Browse). Pops the root to Home and, inside the
 *  workspace stack, pops to Browse if it is beneath — else pushes it once. */
export function openWorkspaceBrowseRoot(navigation: any, workspaceId?: string) {
  returnHome(navigation, {
    screen: "WorkspaceStack",
    params: {
      screen: "Browse",
      params: workspaceId ? { workspaceId } : undefined,
      pop: true,
    } as NavigatorScreenParams<WorkspaceStackParamList>,
  });
}

export function openCollectionAsBrowseRoot(navigation: any, params: CollectionDetailRouteParams) {
  returnHome(navigation, {
    screen: "WorkspaceStack",
    params: {
      screen: "CollectionDetail",
      params,
    },
  });
}

/**
 * Open a collection as a VISIT: pushed on the root stack over whatever opened it,
 * so back returns exactly there. Visiting the collection that is already the
 * visited page only refreshes its params (a second tap on "view in collection"
 * re-highlights the card instead of stacking a copy).
 */
export function visitCollection(navigation: any, params: CollectionDetailRouteParams) {
  const root = getRootNavigation(navigation);
  if (!root?.dispatch) return;
  const current = currentRootRoute(root);
  if (current?.name === "CollectionVisit" && current.params?.collectionId === params.collectionId) {
    root.dispatch({ ...CommonActions.setParams(params), source: current.key });
    return;
  }
  root.dispatch(StackActions.push("CollectionVisit", params));
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
    const params: CollectionDetailRouteParams = {
      collectionId: idea.collectionId,
      workspaceId: workspace.id,
      focusIdeaId: ideaId,
      focusToken: Date.now(),
    };
    // Already looking at that collection inside Home? Just focus the card.
    const root = getRootNavigation(navigation);
    const current = currentRootRoute(root);
    if (current?.name === "Home") {
      const deepest = getDeepestRouteOf(current);
      if (deepest.name === "CollectionDetail" && deepest.params?.collectionId === idea.collectionId) {
        openCollectionAsBrowseRoot(navigation, params);
        return;
      }
    }
    visitCollection(navigation, params);
    return;
  }
  const rootNavigation = getRootNavigation(navigation);
  (rootNavigation ?? navigation)?.navigate?.("IdeaDetail", { ideaId });
}

/** Jump to the Shelf page (drawer) from anywhere — e.g. the set-aside toast's
 *  "View shelf" tap-through. */
export function openShelf(navigation: any) {
  returnHome(navigation, { screen: "ShelfHome" });
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
