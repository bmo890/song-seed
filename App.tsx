import { GestureHandlerRootView } from "react-native-gesture-handler";
import Constants from "expo-constants";
import { ActivityIndicator, View } from "react-native";
import {
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
import { AudioRecorderProvider } from "@siteed/expo-audio-studio";
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
import { ActivityScreen } from "./src/components/ActivityScreen";
import { GlobalMediaDock } from "./src/components/GlobalMediaDock";
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

export type HomeDrawerParamList = {
  Workspaces: undefined;
  Browse: undefined;
  CollectionDetail: CollectionDetailRouteParams | undefined;
  RevisitHome: undefined;
  ActivityHome: undefined;
  LibraryHome: undefined;
  SettingsHome: undefined;
};

export type RootStackParamList = {
  Home: NavigatorScreenParams<HomeDrawerParamList> | undefined;
  IdeaDetail: { ideaId?: string; startInEdit?: boolean } | undefined;
  Activity: { workspaceId?: string; collectionId?: string } | undefined;
  Recording: undefined;
  Player: undefined;
  Tuner: undefined;
  Metronome: undefined;
  ShareImport: undefined;
  Editor: { ideaId: string; clipId: string; audioUri?: string; durationMs?: number };
  Lyrics: { ideaId: string };
  LyricsVersion: { ideaId: string; versionId?: string; startInEdit?: boolean; forceNewVersion?: boolean; createDraft?: boolean };
};
import { useStore } from "./src/state/useStore";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<HomeDrawerParamList>();

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
    args.deepestRouteName === "LyricsVersion"
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
      : deepestRouteName === "Tuner"
        ? "tuner"
      : deepestRouteName === "Metronome"
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
        navigateRoot("Tuner");
      }}
      onGoMetronome={() => {
        closeDrawer();
        navigateRoot("Metronome");
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



function AppContent() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [activeRouteName, setActiveRouteName] = useState<string>("Home");
  const [lastCollectionContextId, setLastCollectionContextId] = useState<string | null>(null);
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

  const syncNavigationState = () => {
    const rootState = navigationRef.getRootState();
    if (!rootState) return;
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
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        onReady={syncNavigationState}
        onStateChange={syncNavigationState}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Home">
          <Stack.Screen name="Home" component={DrawerRoutes} />
          <Stack.Screen name="Activity" component={ActivityScreen} />
          <Stack.Screen name="IdeaDetail" component={IdeaDetailScreen} />
          <Stack.Screen name="Recording" component={RecordingScreen} />
          <Stack.Screen name="Player" component={PlayerScreen} />
          <Stack.Screen name="Tuner" component={TunerScreen} />
          <Stack.Screen name="Metronome" component={MetronomeScreen} />
          <Stack.Screen name="ShareImport">
            {() => <ShareImportScreen fallbackCollectionId={lastCollectionContextId} />}
          </Stack.Screen>
          <Stack.Screen name="Editor" component={EditorScreen} />
          <Stack.Screen name="Lyrics" component={LyricsScreen} />
          <Stack.Screen name="LyricsVersion" component={LyricsVersionScreen} />
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
      </NavigationContainer>
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
