import { GestureHandlerRootView } from "react-native-gesture-handler";
import Constants from "expo-constants";
import { ActivityIndicator, Alert, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type InitialState,
  NavigationContainer,
  useNavigationContainerRef,
  type LinkingOptions,
  type NavigatorScreenParams,
  getStateFromPath as getNavigationStateFromPath,
} from "@react-navigation/native";
import * as Linking from "expo-linking";
import { useEffect, useMemo, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator, DrawerContentComponentProps } from "@react-navigation/drawer";
import { AudioRecorderProvider } from "@siteed/audio-studio";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ShareIntentModule, ShareIntentProvider, getScheme, getShareExtensionKey } from "expo-share-intent";
import { IdeaDetailScreen } from "./src/components/IdeaDetailScreen";
import { IdeaListScreen } from "./src/components/IdeaListScreen";
import { PlayerScreen } from "./src/components/PlayerScreen";
import { RecordingScreen } from "./src/components/RecordingScreen";
import { WorkspaceListScreen } from "./src/components/WorkspaceListScreen";
import { WorkspaceBrowseScreen } from "./src/components/WorkspaceBrowseScreen";
import { SideNav } from "./src/components/SideNav";
import { EditorScreen } from "./src/components/EditorScreen";
import { LyricsScreen } from "./src/components/LyricsScreen";
import { LyricsVersionScreen } from "./src/components/LyricsVersionScreen";
import { ClipLineageScreen } from "./src/components/ClipLineageScreen";
import { ActivityScreen } from "./src/components/ActivityScreen";
import { GlobalMediaDock } from "./src/components/GlobalMediaDock";
import { ImportProgressBanner } from "./src/components/ImportProgressBanner";
import { DuplicateReviewSheet } from "./src/components/DuplicateReviewSheet";
import { LibraryScreen } from "./src/components/LibraryScreen";
import { SettingsScreen } from "./src/components/SettingsScreen";
import { RevisitScreen } from "./src/components/RevisitScreen";
import { TunerScreen } from "./src/components/TunerScreen";
import { MetronomeScreen } from "./src/components/MetronomeScreen";
import { ShareImportScreen } from "./src/components/ShareImportScreen";
import { getCollectionAncestors, getCollectionById } from "./src/utils";
import {
  getRecentCollectionsForWorkspace,
  resolveStartupWorkspaceId,
} from "./src/libraryNavigation";
import type { CollectionDetailRouteParams } from "./src/navigation";
import { cleanupStaleShareTempFiles } from "./src/services/managedMedia";
import { resumePendingWorkspaceArchiveOperations } from "./src/services/workspaceArchiveRecovery";
import { recoverPendingRecordingSession } from "./src/services/recordingRecovery";

const NAVIGATION_STATE_KEY = "song-seed-navigation-state-v1";
const NON_RESTORABLE_ROUTE_NAMES = new Set(["ShareImport"]);

export type HomeDrawerParamList = {
  Workspaces: undefined;
  Browse: undefined;
  CollectionDetail: CollectionDetailRouteParams | undefined;
  RevisitHome: undefined;
  ActivityHome: undefined;
  TunerHome: undefined;
  MetronomeHome: undefined;
  LibraryHome: undefined;
  SettingsHome: undefined;
};

export type RootStackParamList = {
  Home: NavigatorScreenParams<HomeDrawerParamList> | undefined;
  IdeaDetail: { ideaId?: string; startInEdit?: boolean } | undefined;
  Activity: { workspaceId?: string; collectionId?: string } | undefined;
  Recording: undefined;
  Player: undefined;
  ShareImport: undefined;
  Editor: { ideaId: string; clipId: string; audioUri?: string; durationMs?: number };
  Lyrics: { ideaId: string };
  LyricsVersion: { ideaId: string; versionId?: string; startInEdit?: boolean; forceNewVersion?: boolean; createDraft?: boolean };
  ClipLineage: { ideaId: string; rootClipId: string };
};
import { useStore } from "./src/state/useStore";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<HomeDrawerParamList>();
const HOME_DRAWER_ROUTE_NAMES: Array<keyof HomeDrawerParamList> = [
  "Workspaces",
  "Browse",
  "CollectionDetail",
  "RevisitHome",
  "ActivityHome",
  "TunerHome",
  "MetronomeHome",
  "LibraryHome",
  "SettingsHome",
];
const ROOT_STACK_ROUTE_NAMES: Array<keyof RootStackParamList> = [
  "Home",
  "Activity",
  "IdeaDetail",
  "Recording",
  "Player",
  "ShareImport",
  "Editor",
  "Lyrics",
  "LyricsVersion",
  "ClipLineage",
];

function createHomeRoute(
  screen: keyof HomeDrawerParamList = "Workspaces",
  params?: HomeDrawerParamList[keyof HomeDrawerParamList]
): any {
  const routes = HOME_DRAWER_ROUTE_NAMES.map((routeName) =>
    routeName === screen && params !== undefined ? { name: routeName, params } : { name: routeName }
  );

  return {
    name: "Home" as const,
    state: {
      type: "drawer" as const,
      index: Math.max(0, HOME_DRAWER_ROUTE_NAMES.indexOf(screen)),
      routeNames: HOME_DRAWER_ROUTE_NAMES,
      routes,
    },
  };
}

function isValidRestorableRootRoute(route: any) {
  if (!route || typeof route.name !== "string") return false;

  switch (route.name) {
    case "Home":
    case "Activity":
    case "Recording":
    case "Player":
      return true;
    case "IdeaDetail":
      return typeof route.params?.ideaId === "string" && route.params.ideaId.length > 0;
    case "Editor":
      return (
        typeof route.params?.ideaId === "string" &&
        route.params.ideaId.length > 0 &&
        typeof route.params?.clipId === "string" &&
        route.params.clipId.length > 0
      );
    case "Lyrics":
      return typeof route.params?.ideaId === "string" && route.params.ideaId.length > 0;
    case "LyricsVersion":
      return typeof route.params?.ideaId === "string" && route.params.ideaId.length > 0;
    case "ClipLineage":
      return (
        typeof route.params?.ideaId === "string" &&
        route.params.ideaId.length > 0 &&
        typeof route.params?.rootClipId === "string" &&
        route.params.rootClipId.length > 0
      );
    default:
      return false;
  }
}

function normalizeHomeDrawerRoute(route: any): any {
  if (!route || route.name !== "Home") {
    return route;
  }

  if (route.params?.screen && typeof route.params.screen === "string") {
    const targetScreen = route.params.screen as keyof HomeDrawerParamList;
    const targetParams = route.params.params;
    if (HOME_DRAWER_ROUTE_NAMES.includes(targetScreen)) {
      return createHomeRoute(targetScreen, targetParams);
    }
  }

  const state = route.state;
  if (!state?.routes?.length) {
    return createHomeRoute("Workspaces");
  }

  const existingByName = new Map<string, any>();
  state.routes.forEach((childRoute: any) => {
    if (childRoute?.name) {
      existingByName.set(childRoute.name, childRoute);
    }
  });
  const currentRoute = state.routes[state.index ?? 0];
  const currentRouteName = HOME_DRAWER_ROUTE_NAMES.includes(currentRoute?.name)
    ? currentRoute.name
    : "Workspaces";
  const normalizedRoutes = HOME_DRAWER_ROUTE_NAMES.map((routeName) => {
    const existingRoute = existingByName.get(routeName);
    return existingRoute ? { ...existingRoute } : { name: routeName };
  });

  return {
    ...route,
    state: {
      ...state,
      stale: false,
      type: "drawer",
      routeNames: HOME_DRAWER_ROUTE_NAMES,
      routes: normalizedRoutes,
      index: Math.max(0, HOME_DRAWER_ROUTE_NAMES.indexOf(currentRouteName)),
    },
  };
}

function sanitizeNavigationState(state: InitialState | undefined): InitialState | undefined {
  if (!state?.routes?.length) return state;

  const normalizedRoutes = state.routes
    .map((route) => {
      if (route.name === "Tuner") {
        return createHomeRoute("TunerHome");
      }

      if (route.name === "Metronome") {
        return createHomeRoute("MetronomeHome");
      }

      if (route.name === "Home") {
        return normalizeHomeDrawerRoute(route);
      }

      return route;
    })
    .filter(Boolean);

  const homeRouteIndexes = normalizedRoutes
    .map((route, index) => (route.name === "Home" ? index : -1))
    .filter((index) => index >= 0);
  const lastHomeIndex = homeRouteIndexes[homeRouteIndexes.length - 1] ?? -1;
  const lastHomeRoute =
    (lastHomeIndex >= 0 ? normalizedRoutes[lastHomeIndex] : null) ?? createHomeRoute("Workspaces");
  const trailingRoutes =
    lastHomeIndex >= 0
      ? normalizedRoutes
          .slice(lastHomeIndex + 1)
          .filter((route) => route.name !== "Home" && isValidRestorableRootRoute(route))
      : [];
  const routes = [lastHomeRoute, ...trailingRoutes];

  return {
    ...state,
    type: "stack",
    routeNames: ROOT_STACK_ROUTE_NAMES,
    routes,
    index: routes.length - 1,
  };
}

function getActiveWorkspaceRouteContext(args: {
  deepestRouteName: string;
  deepestParams: Record<string, unknown>;
  workspaces: ReturnType<typeof useStore.getState>["workspaces"];
  activeWorkspaceId: string | null;
  selectedIdeaId: string | null;
  playerTarget: ReturnType<typeof useStore.getState>["playerTarget"];
}) {
  const activeWorkspace =
    args.workspaces.find((workspace) => workspace.id === args.activeWorkspaceId) ?? null;
  const routeIdeaId =
    args.deepestRouteName === "IdeaDetail" ||
    args.deepestRouteName === "Editor" ||
    args.deepestRouteName === "Lyrics" ||
    args.deepestRouteName === "LyricsVersion" ||
    args.deepestRouteName === "ClipLineage"
      ? (args.deepestParams.ideaId as string | undefined) ?? args.selectedIdeaId
      : args.deepestRouteName === "Player"
        ? args.playerTarget?.ideaId ?? args.selectedIdeaId
        : args.selectedIdeaId;
  const routeIdea =
    routeIdeaId && activeWorkspace
      ? activeWorkspace.ideas.find((idea) => idea.id === routeIdeaId) ?? null
      : null;
  const currentCollectionId =
    (args.deepestParams.collectionId as string | undefined) ?? routeIdea?.collectionId ?? null;
  const currentCollection =
    currentCollectionId && activeWorkspace
      ? getCollectionById(activeWorkspace, currentCollectionId)
      : null;
  const currentCollectionRootId =
    activeWorkspace && currentCollection
      ? getCollectionAncestors(activeWorkspace, currentCollection.id)[0]?.id ?? currentCollection.id
      : null;

  return {
    activeWorkspace,
    currentCollection,
    currentCollectionId,
    currentCollectionRootId,
  };
}

function DrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const collectionLastOpenedAt = useStore((s) => s.collectionLastOpenedAt);
  const selectedIdeaId = useStore((s) => s.selectedIdeaId);
  const playerTarget = useStore((s) => s.playerTarget);
  const rootNavigation = (navigation as any).getParent?.();
  const navigateRoot = (route: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(route as never, params as never);
  const deepestRoute = getDeepestRoute((rootNavigation ?? navigation).getState?.() ?? state);
  const deepestRouteName = deepestRoute.name;
  const deepestParams = deepestRoute.params ?? {};
  const { activeWorkspace, currentCollectionRootId } = getActiveWorkspaceRouteContext({
    deepestRouteName,
    deepestParams,
    workspaces,
    activeWorkspaceId,
    selectedIdeaId,
    playerTarget,
  });
  const currentRoute =
    deepestRouteName === "Workspaces"
      ? "home"
      : deepestRouteName === "Browse" || deepestRouteName === "CollectionDetail"
        ? "browse"
      : deepestRouteName === "RevisitHome"
        ? "revisit"
      : deepestRouteName === "Activity" || deepestRouteName === "ActivityHome"
        ? "activity"
      : deepestRouteName === "TunerHome"
        ? "tuner"
      : deepestRouteName === "MetronomeHome"
        ? "metronome"
      : deepestRouteName === "LibraryHome"
          ? "library"
          : deepestRouteName === "SettingsHome"
            ? "settings"
            : null;

  const recentCollections = activeWorkspace
    ? getRecentCollectionsForWorkspace(activeWorkspace, collectionLastOpenedAt, 2).map((entry) => ({
        id: entry.collection.id,
        title: entry.collection.title,
        level: entry.level,
        meta: entry.pathLabel ?? undefined,
        active: entry.collection.id === currentCollectionRootId,
      }))
    : [];

  const favoriteItems = useMemo(
    () =>
      workspaces
        .flatMap((ws) => ws.ideas)
        .filter((idea) => idea.isFavorite)
        .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
        .slice(0, 5)
        .map((idea) => ({ id: idea.id, title: idea.title, kind: idea.kind })),
    [workspaces]
  );

  const closeDrawer = () => {
    navigation.closeDrawer();
  };

  return (
    <SideNav
      currentRoute={currentRoute}
      workspaceTitle={activeWorkspace?.title ?? null}
      recentCollections={recentCollections}
      favoriteItems={favoriteItems}
      onGoHome={() => {
        closeDrawer();
        navigation.navigate("Workspaces");
      }}
      onGoWorkspace={() => {
        closeDrawer();
        navigation.navigate("Browse");
      }}
      onGoRevisit={() => {
        closeDrawer();
        navigation.navigate("RevisitHome");
      }}
      onGoActivity={() => {
        closeDrawer();
        navigation.navigate("ActivityHome");
      }}
      onGoTuner={() => {
        closeDrawer();
        navigation.navigate("TunerHome");
      }}
      onGoMetronome={() => {
        closeDrawer();
        navigation.navigate("MetronomeHome");
      }}
      onGoLibrary={() => {
        closeDrawer();
        navigation.navigate("LibraryHome");
      }}
      onGoSettings={() => {
        closeDrawer();
        navigation.navigate("SettingsHome");
      }}
      onOpenCollection={(collectionId) => {
        closeDrawer();
        navigation.navigate("CollectionDetail", { collectionId });
      }}
      onOpenFavorite={(ideaId) => {
        closeDrawer();
        useStore.getState().setSelectedIdeaId(ideaId);
        navigateRoot("IdeaDetail", { ideaId });
      }}
      onClose={() => {
        closeDrawer();
      }}
    />
  );
}

function DrawerRoutes() {
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const primaryWorkspaceId = useStore((s) => s.primaryWorkspaceId);
  const lastUsedWorkspaceId = useStore((s) => s.lastUsedWorkspaceId);
  const workspaceStartupPreference = useStore((s) => s.workspaceStartupPreference);
  const setActiveWorkspaceId = useStore((s) => s.setActiveWorkspaceId);
  const startupWorkspaceId = useMemo(
    () =>
      resolveStartupWorkspaceId({
        workspaces,
        primaryWorkspaceId,
        lastUsedWorkspaceId,
        preference: workspaceStartupPreference,
      }),
    [lastUsedWorkspaceId, primaryWorkspaceId, workspaceStartupPreference, workspaces]
  );
  const [startupApplied, setStartupApplied] = useState(false);

  useEffect(() => {
    if (startupApplied) return;
    if (!startupWorkspaceId) {
      setStartupApplied(true);
      return;
    }
    if (activeWorkspaceId !== startupWorkspaceId) {
      setActiveWorkspaceId(startupWorkspaceId);
      return;
    }
    setStartupApplied(true);
  }, [activeWorkspaceId, setActiveWorkspaceId, startupApplied, startupWorkspaceId]);

  if (!startupApplied && startupWorkspaceId && activeWorkspaceId !== startupWorkspaceId) {
    return null;
  }

  return (
    <Drawer.Navigator
      screenOptions={{ headerShown: false }}
      drawerContent={(props) => <DrawerContent {...props} />}
      initialRouteName={startupWorkspaceId ? "Browse" : "Workspaces"}
    >
      <Drawer.Screen name="Workspaces" component={WorkspaceListScreen} />
      <Drawer.Screen name="Browse" component={WorkspaceBrowseScreen} />
      <Drawer.Screen name="CollectionDetail" component={IdeaListScreen} />
      <Drawer.Screen name="RevisitHome" component={RevisitScreen} />
      <Drawer.Screen name="ActivityHome" component={ActivityScreen} />
      <Drawer.Screen name="TunerHome" component={TunerScreen} />
      <Drawer.Screen name="MetronomeHome" component={MetronomeScreen} />
      <Drawer.Screen name="LibraryHome" component={LibraryScreen} />
      <Drawer.Screen name="SettingsHome" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}

function getDeepestRoute(state: any): { name: string; params?: Record<string, unknown> } {
  if (!state?.routes?.length) return { name: "Home" };
  const route = state.routes[state.index ?? 0];
  if (route?.state) {
    return getDeepestRoute(route.state);
  }
  return { name: route?.name ?? "Home", params: route?.params };
}

function shouldPersistNavigationState(state: InitialState | undefined) {
  if (!state) return false;
  const deepestRoute = getDeepestRoute(state);
  return !NON_RESTORABLE_ROUTE_NAMES.has(deepestRoute.name);
}

function normalizeRestoredNavigationState(state: InitialState | undefined): InitialState | undefined {
  return sanitizeNavigationState(state);
}



function AppContent() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [activeRouteName, setActiveRouteName] = useState<string>("Home");
  const [lastCollectionContextId, setLastCollectionContextId] = useState<string | null>(null);
  const [initialNavigationState, setInitialNavigationState] = useState<InitialState | undefined>(undefined);
  const [navigationStateReady, setNavigationStateReady] = useState(false);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const selectedIdeaId = useStore((s) => s.selectedIdeaId);
  const playerTarget = useStore((s) => s.playerTarget);
  const appScheme = getScheme() ?? Constants.expoConfig?.scheme ?? "songseed";
  const shareExtensionKey = getShareExtensionKey();
  const packageName =
    Constants.expoConfig?.android?.package ?? Constants.expoConfig?.ios?.bundleIdentifier ?? null;
  const prefix = Linking.createURL("/");
  const shareImportUrl = `${appScheme}://share-import`;

  const linking = useMemo<LinkingOptions<RootStackParamList>>(
    () => ({
      prefixes: [
        `${appScheme}://`,
        ...(packageName ? [`${packageName}://`] : []),
        prefix,
      ],
      config: {
        initialRouteName: "Home",
        screens: {
          Home: "home",
          ShareImport: "share-import",
        },
      },
      getStateFromPath(path, config) {
        if (path.includes(`dataUrl=${shareExtensionKey}`)) {
          return {
            routes: [{ name: "ShareImport" }],
          };
        }

        return getNavigationStateFromPath(path, config);
      },
      subscribe(listener) {
        const onReceiveURL = ({ url }: { url: string }) => {
          if (url.includes(shareExtensionKey)) {
            listener(shareImportUrl);
            return;
          }
          listener(url);
        };

        const shareIntentStateSubscription = ShareIntentModule?.addListener(
          "onStateChange",
          (event) => {
            if (event.value === "pending") {
              listener(shareImportUrl);
            }
          }
        );
        const shareIntentValueSubscription = ShareIntentModule?.addListener(
          "onChange",
          async () => {
            const url = await Linking.getLinkingURL();
            if (url) {
              onReceiveURL({ url });
            }
          }
        );
        const urlEventSubscription = Linking.addEventListener("url", onReceiveURL);

        return () => {
          shareIntentStateSubscription?.remove();
          shareIntentValueSubscription?.remove();
          urlEventSubscription.remove();
        };
      },
      async getInitialURL() {
        const needsShareRedirect = ShareIntentModule?.hasShareIntent(shareExtensionKey);
        if (needsShareRedirect) {
          return shareImportUrl;
        }

        return await Linking.getLinkingURL();
      },
    }),
    [appScheme, packageName, prefix, shareExtensionKey, shareImportUrl]
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const initialUrl = await linking.getInitialURL?.();
        if (initialUrl) {
          return;
        }

        const storedState = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);
        if (!storedState) {
          return;
        }

        const parsedState = normalizeRestoredNavigationState(JSON.parse(storedState) as InitialState);
        if (!cancelled) {
          setInitialNavigationState(parsedState);
        }
      } catch (error) {
        console.warn("Navigation restore error", error);
      } finally {
        if (!cancelled) {
          setNavigationStateReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [linking]);

  const syncNavigationState = () => {
    const rootState = navigationRef.getRootState();
    if (!rootState) return;
    const sanitizedRootState = sanitizeNavigationState(rootState);
    if (shouldPersistNavigationState(rootState) && sanitizedRootState) {
      // Persist the last stable navigation tree so the app can reopen where the
      // user left it instead of always dropping back to Home on relaunch. Sanitize
      // it first so detail screens do not restore from invalid params and so the
      // root stack does not accumulate duplicate Home routes forever.
      void AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(sanitizedRootState));
    }
    const deepestRoute = getDeepestRoute(rootState);
    const nextRoute = deepestRoute.name;
    setActiveRouteName((prev) => (prev === nextRoute ? prev : nextRoute));
    if (nextRoute === "ShareImport") return;

    const routeContext = getActiveWorkspaceRouteContext({
      deepestRouteName: deepestRoute.name,
      deepestParams: deepestRoute.params ?? {},
      workspaces,
      activeWorkspaceId,
      selectedIdeaId,
      playerTarget,
    });
    setLastCollectionContextId((prev) =>
      prev === routeContext.currentCollectionId ? prev : routeContext.currentCollectionId
    );
  };

  return (
    <ShareIntentProvider
      options={{
        disabled: !ShareIntentModule,
        resetOnBackground: false,
        onResetShareIntent: () => {
          if (!navigationRef.isReady()) return;
          if (navigationRef.getCurrentRoute()?.name === "ShareImport") {
            navigationRef.navigate("Home");
          }
        },
      }}
    >
      {!navigationStateReady ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <ActivityIndicator color="#0f172a" />
        </View>
      ) : (
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        initialState={initialNavigationState}
        onReady={syncNavigationState}
        onStateChange={syncNavigationState}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Home">
          <Stack.Screen name="Home" component={DrawerRoutes} />
          <Stack.Screen name="Activity" component={ActivityScreen} />
          <Stack.Screen name="IdeaDetail" component={IdeaDetailScreen} />
          <Stack.Screen name="Recording" component={RecordingScreen} />
          <Stack.Screen name="Player" component={PlayerScreen} />
          <Stack.Screen name="ShareImport">
            {() => <ShareImportScreen fallbackCollectionId={lastCollectionContextId} />}
          </Stack.Screen>
          <Stack.Screen name="Editor" component={EditorScreen} />
          <Stack.Screen name="Lyrics" component={LyricsScreen} />
          <Stack.Screen name="LyricsVersion" component={LyricsVersionScreen} />
          <Stack.Screen name="ClipLineage" component={ClipLineageScreen} />
        </Stack.Navigator>
        <GlobalMediaDock
          activeRouteName={activeRouteName}
          onOpenPlayer={() => {
            if (!navigationRef.isReady()) return;
            navigationRef.navigate("Player");
          }}
          onOpenRecording={() => {
            if (!navigationRef.isReady()) return;
            navigationRef.navigate("Recording");
          }}
        />
        <ImportProgressBanner />
        <DuplicateReviewSheet />
      </NavigationContainer>
      )}
    </ShareIntentProvider>
  );
}

export default function App() {
  const [hasHydrated, setHasHydrated] = useState(() => useStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribeStartHydration = useStore.persist.onHydrate(() => {
      setHasHydrated(false);
    });
    const unsubscribeFinishHydration = useStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    if (!useStore.persist.hasHydrated()) {
      void useStore.persist.rehydrate();
    }

    return () => {
      unsubscribeStartHydration();
      unsubscribeFinishHydration();
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    // Sweep stale share/export temp files after hydration so the app does not keep growing
    // storage usage from artifacts that were never part of persisted user state.
    void (async () => {
      await cleanupStaleShareTempFiles();
      await resumePendingWorkspaceArchiveOperations();
      const recordingRecovery = await recoverPendingRecordingSession();
      if (recordingRecovery.status === "recovered") {
        Alert.alert(
          "Recovered recording",
          `${recordingRecovery.title} was restored after the previous session ended unexpectedly.`
        );
      } else if (recordingRecovery.status === "failed") {
        Alert.alert(
          "Recording recovery failed",
          "Song Seed found an unfinished recording from the previous session but could not restore it automatically."
        );
      }
    })();
  }, [hasHydrated]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AudioRecorderProvider>
          {!hasHydrated ? (
            // Hold the app shell until persist rehydrates so no screen can mount against the
            // default store and accidentally serialize an empty snapshot back to AsyncStorage.
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f8fafc",
              }}
            >
              <ActivityIndicator color="#0f172a" />
            </View>
          ) : (
            <AppContent />
          )}
        </AudioRecorderProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
