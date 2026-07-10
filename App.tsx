import { GestureHandlerRootView } from "react-native-gesture-handler";
import Constants from "expo-constants";
import { ActivityIndicator, Alert, View } from "react-native";
import { useFonts } from "expo-font";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  type InitialState,
  NavigationContainer,
  createNavigationContainerRef,
  type LinkingOptions,
  type NavigatorScreenParams,
  getStateFromPath as getNavigationStateFromPath,
} from "@react-navigation/native";
import * as Linking from "expo-linking";
import { useEffect, useMemo, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createDrawerNavigator,
  getDrawerStatusFromState,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { AudioRecorderProvider } from "@siteed/audio-studio";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ShareIntentModule, ShareIntentProvider, getScheme, getShareExtensionKey } from "expo-share-intent";
import { IdeaDetailScreen } from "./src/components/IdeaDetailScreen";
import { IdeaListScreen } from "./src/components/IdeaListScreen";
import { PlayerSheet } from "./src/components/PlayerSheet";
import { PlayerSheetPositionProvider } from "./src/hooks/PlayerSheetPositionProvider";
import { RecordingScreen } from "./src/components/RecordingScreen";
import { WorkspaceListScreen } from "./src/components/WorkspaceListScreen";
import { WorkspaceBrowseScreen } from "./src/components/WorkspaceBrowseScreen";
import { SideNav } from "./src/components/SideNav";
import { EditorScreen } from "./src/components/EditorScreen";
import { LyricsScreen } from "./src/components/LyricsScreen";
import { LyricsVersionScreen } from "./src/components/LyricsVersionScreen";
import { ChordSheetScreen } from "./src/components/ChordSheetScreen";
import { ClipLineageScreen } from "./src/components/ClipLineageScreen";
import { ActivityScreen } from "./src/components/ActivityScreen";
import { GlobalMediaDock } from "./src/components/GlobalMediaDock";
import { ImportProgressBanner } from "./src/components/ImportProgressBanner";
import { LibraryProcessHost } from "./src/components/LibraryProcessHost";
import { DuplicateReviewSheet } from "./src/components/DuplicateReviewSheet";
import { LibraryScreen } from "./src/components/LibraryScreen";
import { SettingsScreen } from "./src/components/SettingsScreen";
import { RevisitScreen } from "./src/components/RevisitScreen";
import { TunerScreen } from "./src/components/TunerScreen";
import { NotepadScreen } from "./src/components/NotepadScreen";
import { WordLadderScreen } from "./src/components/WordLadderScreen";
import { CutUpScreen } from "./src/components/CutUpScreen";
import { MagpieScreen } from "./src/components/MagpieScreen";
import { MetronomeScreen } from "./src/components/MetronomeScreen";
import { ShareImportScreen } from "./src/components/ShareImportScreen";
import { SearchScreen } from "./src/components/SearchScreen";
import { installWordLookupCache } from "./src/services/wordLookupCache";
import { BluetoothCalibrationScreen } from "./src/components/BluetoothCalibrationScreen";
import { getCollectionAncestors, getCollectionById } from "./src/utils";
import {
  getRecentCollectionsForWorkspace,
  resolveStartupWorkspaceId,
} from "./src/libraryNavigation";
import type { CollectionDetailRouteParams } from "./src/navigation";
import { openIdeaInCollection } from "./src/navigation";
import { cleanupStaleShareTempFiles, purgeExpiredTrash } from "./src/services/managedMedia";
import { readManifest } from "./src/services/manifestSync";
import { appActions } from "./src/state/actions";
import {
  buildBackupReminderPromptMessage,
  markBackupReminderPromptShown,
  shouldPromptForBackupReminder,
} from "./src/services/backupStatus";
import { resumePendingWorkspaceArchiveOperations } from "./src/services/workspaceArchiveRecovery";
import { recoverPendingRecordingSession } from "./src/services/recordingRecovery";
import { cleanupStaleDisasterRecoveryBackupFiles } from "./src/services/disasterRecoveryBackup";
import { cleanupInterruptedDisasterRecoveryRestores } from "./src/services/disasterRecoveryTemp";


export type HomeDrawerParamList = {
  Workspaces: undefined;
  WorkspaceStack: NavigatorScreenParams<WorkspaceStackParamList> | undefined;
  SearchHome: undefined;
  RevisitHome: undefined;
  ActivityHome: undefined;
  TunerHome: undefined;
  MetronomeHome: undefined;
  LibraryHome: { openPlaylistId?: string; openToken?: number } | undefined;
  SettingsHome: undefined;
  NotepadHome: { noteId?: string; openToken?: number } | undefined;
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
  IdeaDetail: { ideaId?: string; startInEdit?: boolean } | undefined;
  Activity: { workspaceId?: string; collectionId?: string } | undefined;
  Recording: undefined;
  BluetoothCalibration: undefined;
  ShareImport: undefined;
  Editor: { ideaId: string; clipId: string; audioUri?: string; durationMs?: number };
  Lyrics: { ideaId: string };
  LyricsVersion: { ideaId: string; versionId?: string; startInEdit?: boolean; forceNewVersion?: boolean; createDraft?: boolean };
  ChordSheet: { ideaId: string };
  ClipLineage: { ideaId: string; rootClipId: string };
};

const navigationRef = createNavigationContainerRef<RootStackParamList>();
import { useStore } from "./src/state/useStore";
import { AppDialogHost } from "./src/components/common/AppDialog";
import { RestoreRestartGate } from "./src/components/common/RestoreRestartGate";
import { FullPlayerProvider } from "./src/hooks/FullPlayerProvider";

// Durable Word Finder cache (SQLite) — registered once; touched lazily on first lookup.
installWordLookupCache();

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<HomeDrawerParamList>();
const WorkspaceStack = createNativeStackNavigator<WorkspaceStackParamList>();
const HOME_DRAWER_ROUTE_NAMES: Array<keyof HomeDrawerParamList> = [
  "Workspaces",
  "WorkspaceStack",
  "SearchHome",
  "RevisitHome",
  "ActivityHome",
  "TunerHome",
  "MetronomeHome",
  "LibraryHome",
  "SettingsHome",
  "NotepadHome",
  "WordLadderHome",
  "CutUpHome",
  "MagpieHome",
];
const WORKSPACE_STACK_ROUTE_NAMES: Array<keyof WorkspaceStackParamList> = [
  "Browse",
  "CollectionDetail",
];
const ROOT_STACK_ROUTE_NAMES: Array<keyof RootStackParamList> = [
  "Home",
  "Activity",
  "IdeaDetail",
  "Recording",
  "BluetoothCalibration",
  "ShareImport",
  "Editor",
  "Lyrics",
  "LyricsVersion",
  "ChordSheet",
  "ClipLineage",
];

function createHomeRoute(
  screen: keyof HomeDrawerParamList = "Workspaces",
  params?: HomeDrawerParamList[keyof HomeDrawerParamList]
): any {
  const routes = HOME_DRAWER_ROUTE_NAMES.map((routeName) => {
    if (routeName === "WorkspaceStack") {
      if (screen === "WorkspaceStack") {
        return createWorkspaceStackDrawerRoute(
          (params as NavigatorScreenParams<WorkspaceStackParamList> | undefined)?.screen ?? "Browse",
          (params as NavigatorScreenParams<WorkspaceStackParamList> | undefined)?.params
        );
      }
      return createWorkspaceStackDrawerRoute();
    }

    return routeName === screen && params !== undefined ? { name: routeName, params } : { name: routeName };
  });

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

function createWorkspaceStackDrawerRoute(
  screen: keyof WorkspaceStackParamList = "Browse",
  params?: WorkspaceStackParamList[keyof WorkspaceStackParamList]
): any {
  const routes = WORKSPACE_STACK_ROUTE_NAMES.map((routeName) =>
    routeName === screen && params !== undefined ? { name: routeName, params } : { name: routeName }
  );

  return {
    name: "WorkspaceStack" as const,
    state: {
      type: "stack" as const,
      index: Math.max(0, WORKSPACE_STACK_ROUTE_NAMES.indexOf(screen)),
      routeNames: WORKSPACE_STACK_ROUTE_NAMES,
      routes,
    },
  };
}

function normalizeWorkspaceStackRoute(route: any): any {
  if (!route) {
    return createWorkspaceStackDrawerRoute("Browse");
  }

  if (route.name === "Browse" || route.name === "CollectionDetail") {
    return createWorkspaceStackDrawerRoute(route.name, route.params);
  }

  if (route.params?.screen && typeof route.params.screen === "string") {
    const targetScreen = route.params.screen as keyof WorkspaceStackParamList;
    const targetParams = route.params.params;
    if (WORKSPACE_STACK_ROUTE_NAMES.includes(targetScreen)) {
      return createWorkspaceStackDrawerRoute(targetScreen, targetParams);
    }
  }

  const state = route.state;
  if (!state?.routes?.length) {
    return createWorkspaceStackDrawerRoute("Browse");
  }

  const currentRoute = state.routes[state.index ?? 0];
  const currentRouteName = WORKSPACE_STACK_ROUTE_NAMES.includes(currentRoute?.name)
    ? currentRoute.name
    : "Browse";
  const normalizedRoutes = WORKSPACE_STACK_ROUTE_NAMES.map((routeName) => {
    const existingRoute = state.routes.find((candidate: any) => candidate?.name === routeName);
    return existingRoute ? { ...existingRoute } : { name: routeName };
  });

  return {
    name: "WorkspaceStack" as const,
    state: {
      ...state,
      stale: false,
      type: "stack",
      routeNames: WORKSPACE_STACK_ROUTE_NAMES,
      routes: normalizedRoutes,
      index: Math.max(0, WORKSPACE_STACK_ROUTE_NAMES.indexOf(currentRouteName)),
    },
  };
}

function isValidRestorableRootRoute(route: any) {
  if (!route || typeof route.name !== "string") return false;

  switch (route.name) {
    case "Home":
    case "Activity":
    case "Recording":
    case "BluetoothCalibration":
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
    const targetScreen = route.params.screen as string;
    const targetParams = route.params.params;

    if (targetScreen === "Browse" || targetScreen === "CollectionDetail") {
      return createHomeRoute("WorkspaceStack", {
        screen: targetScreen,
        params: targetParams,
      });
    }

    if (HOME_DRAWER_ROUTE_NAMES.includes(targetScreen as keyof HomeDrawerParamList)) {
      return createHomeRoute(targetScreen as keyof HomeDrawerParamList, targetParams);
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
  const currentRouteName =
    currentRoute?.name === "Browse" || currentRoute?.name === "CollectionDetail"
      ? "WorkspaceStack"
      : HOME_DRAWER_ROUTE_NAMES.includes(currentRoute?.name)
        ? currentRoute.name
        : "Workspaces";
  const normalizedRoutes = HOME_DRAWER_ROUTE_NAMES.map((routeName) => {
    if (routeName === "WorkspaceStack") {
      return normalizeWorkspaceStackRoute(
        existingByName.get("WorkspaceStack") ??
          existingByName.get("CollectionDetail") ??
          existingByName.get("Browse")
      );
    }

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
  const routeCollectionId = args.deepestParams.collectionId as string | undefined;
  const routeWorkspaceId = args.deepestParams.workspaceId as string | undefined;
  const routeWorkspace =
    (routeWorkspaceId
      ? args.workspaces.find((workspace) => workspace.id === routeWorkspaceId) ?? null
      : routeCollectionId
        ? args.workspaces.find((workspace) =>
            workspace.collections.some((collection) => collection.id === routeCollectionId)
          ) ?? null
        : null);
  const activeWorkspace = routeWorkspace ??
    args.workspaces.find((workspace) => workspace.id === args.activeWorkspaceId) ?? null;
  const routeIdeaId =
    args.deepestRouteName === "IdeaDetail" ||
    args.deepestRouteName === "Editor" ||
    args.deepestRouteName === "Lyrics" ||
    args.deepestRouteName === "LyricsVersion" ||
    args.deepestRouteName === "ClipLineage"
      ? (args.deepestParams.ideaId as string | undefined) ?? args.selectedIdeaId
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
      : deepestRouteName === "SearchHome"
        ? "search"
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
            : deepestRouteName === "NotepadHome" ||
                deepestRouteName === "WordLadderHome" ||
                deepestRouteName === "CutUpHome" ||
                deepestRouteName === "MagpieHome"
              ? "notepad"
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

  const closeDrawer = () => {
    navigation.closeDrawer();
  };

  return (
    <SideNav
      currentRoute={currentRoute}
      workspaceTitle={activeWorkspace?.title ?? null}
      workspaceColor={activeWorkspace?.color}
      workspaceAvatarKey={activeWorkspace?.avatarKey}
      recentCollections={recentCollections}
      onGoHome={() => {
        closeDrawer();
        navigation.navigate("Workspaces");
      }}
      onGoWorkspace={() => {
        closeDrawer();
        navigation.navigate("WorkspaceStack", {
          screen: "Browse",
          params: activeWorkspace?.id ? { workspaceId: activeWorkspace.id } : undefined,
        });
      }}
      onGoRevisit={() => {
        closeDrawer();
        navigation.navigate("RevisitHome");
      }}
      onGoSearch={() => {
        closeDrawer();
        navigation.navigate("SearchHome");
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
      onGoNotepad={() => {
        closeDrawer();
        navigation.navigate("NotepadHome");
      }}
      onOpenCollection={(collectionId) => {
        closeDrawer();
        navigation.navigate("WorkspaceStack", {
          screen: "CollectionDetail",
          params: { collectionId, workspaceId: activeWorkspace?.id },
        });
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
    if (startupWorkspaceId && activeWorkspaceId !== startupWorkspaceId) {
      setActiveWorkspaceId(startupWorkspaceId);
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
      initialRouteName={startupWorkspaceId ? "WorkspaceStack" : "Workspaces"}
    >
      <Drawer.Screen name="Workspaces" component={WorkspaceListScreen} />
      <Drawer.Screen name="WorkspaceStack" component={WorkspaceRoutes} />
      <Drawer.Screen name="SearchHome" component={SearchScreen} />
      <Drawer.Screen name="RevisitHome" component={RevisitScreen} />
      <Drawer.Screen name="ActivityHome" component={ActivityScreen} />
      <Drawer.Screen name="TunerHome" component={TunerScreen} />
      <Drawer.Screen name="MetronomeHome" component={MetronomeScreen} />
      <Drawer.Screen name="LibraryHome" component={LibraryScreen} />
      <Drawer.Screen name="SettingsHome" component={SettingsScreen} />
      <Drawer.Screen name="NotepadHome" component={NotepadScreen} />
      <Drawer.Screen name="WordLadderHome" component={WordLadderScreen} />
      <Drawer.Screen name="CutUpHome" component={CutUpScreen} />
      <Drawer.Screen name="MagpieHome" component={MagpieScreen} />
    </Drawer.Navigator>
  );
}

function WorkspaceRoutes() {
  return (
    <WorkspaceStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Browse">
      <WorkspaceStack.Screen name="Browse" component={WorkspaceBrowseScreen} />
      <WorkspaceStack.Screen name="CollectionDetail" component={IdeaListScreen} />
    </WorkspaceStack.Navigator>
  );
}

function buildStartupNavigationState(args: {
  workspaces: ReturnType<typeof useStore.getState>["workspaces"];
  startupWorkspaceId: string | null;
  primaryCollectionIdByWorkspace: Record<string, string | null>;
}): InitialState | undefined {
  const startupWorkspace = args.workspaces.find((workspace) => workspace.id === args.startupWorkspaceId) ?? null;
  const startupCollectionId =
    startupWorkspace && !startupWorkspace.isArchived
      ? args.primaryCollectionIdByWorkspace[startupWorkspace.id] ?? null
      : null;

  const homeRoute = startupCollectionId
    ? createHomeRoute("WorkspaceStack", {
        screen: "CollectionDetail",
        params: {
          collectionId: startupCollectionId,
          workspaceId: startupWorkspace?.id,
        },
      })
    : startupWorkspace
      ? createHomeRoute("WorkspaceStack", {
          screen: "Browse",
          params: {
            workspaceId: startupWorkspace.id,
          },
        })
      : createHomeRoute("Workspaces");

  return sanitizeNavigationState({
    stale: false,
    type: "stack",
    routeNames: ROOT_STACK_ROUTE_NAMES,
    routes: [homeRoute],
    index: 0,
  } as InitialState);
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
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const [activeRouteName, setActiveRouteName] = useState<string>("Home");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [lastCollectionContextId, setLastCollectionContextId] = useState<string | null>(null);
  const [initialNavigationState, setInitialNavigationState] = useState<InitialState | undefined>(undefined);
  const [navigationStateReady, setNavigationStateReady] = useState(false);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const primaryWorkspaceId = useStore((s) => s.primaryWorkspaceId);
  const lastUsedWorkspaceId = useStore((s) => s.lastUsedWorkspaceId);
  const workspaceStartupPreference = useStore((s) => s.workspaceStartupPreference);
  const primaryCollectionIdByWorkspace = useStore((s) => s.primaryCollectionIdByWorkspace);
  const selectedIdeaId = useStore((s) => s.selectedIdeaId);
  const playerTarget = useStore((s) => s.playerTarget);
  const appScheme = getScheme() ?? Constants.expoConfig?.scheme ?? "songseed";
  const shareExtensionKey = getShareExtensionKey();
  const packageName =
    Constants.expoConfig?.android?.package ?? Constants.expoConfig?.ios?.bundleIdentifier ?? null;
  const prefix = Linking.createURL("/");
  const shareImportUrl = `${appScheme}://share-import`;
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
  const startupNavigationState = useMemo(
    () =>
      buildStartupNavigationState({
        workspaces,
        startupWorkspaceId,
        primaryCollectionIdByWorkspace,
      }),
    [primaryCollectionIdByWorkspace, startupWorkspaceId, workspaces]
  );

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
        if (!cancelled) {
          setInitialNavigationState(startupNavigationState);
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
  }, [linking, startupNavigationState]);

  const syncNavigationState = () => {
    const rootState = navigationRef.getRootState();
    if (!rootState) return;
    const deepestRoute = getDeepestRoute(rootState);
    const nextRoute = deepestRoute.name;
    setActiveRouteName((prev) => (prev === nextRoute ? prev : nextRoute));

    // The side drawer must sit above everything — including the media dock,
    // which renders as a root overlay. Track drawer status so the dock can hide
    // while the drawer is open.
    const homeRoute: any = rootState.routes?.find?.((item: any) => item.name === "Home");
    const drawerOpen =
      homeRoute?.state?.type === "drawer" &&
      getDrawerStatusFromState(homeRoute.state) === "open";
    setIsDrawerOpen((prev) => (prev === drawerOpen ? prev : drawerOpen));
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
      {!navigationStateReady || !fontsLoaded ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FDFBF7",
          }}
        >
          <ActivityIndicator color="#B87D6B" />
        </View>
      ) : (
      <FullPlayerProvider>
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
          <Stack.Screen name="BluetoothCalibration" component={BluetoothCalibrationScreen} />
          {/* The full player is NOT a route — it's the PlayerSheet overlay below,
              a sibling of the media dock (per docs/audio-architecture-plan.md). */}
          <Stack.Screen name="ShareImport">
            {() => <ShareImportScreen fallbackCollectionId={lastCollectionContextId} />}
          </Stack.Screen>
          <Stack.Screen name="Editor" component={EditorScreen} />
          <Stack.Screen name="Lyrics" component={LyricsScreen} />
          <Stack.Screen name="LyricsVersion" component={LyricsVersionScreen} />
          <Stack.Screen name="ChordSheet" component={ChordSheetScreen} />
          <Stack.Screen name="ClipLineage" component={ClipLineageScreen} />
        </Stack.Navigator>
        <PlayerSheetPositionProvider>
        <GlobalMediaDock
          activeRouteName={activeRouteName}
          hidden={isDrawerOpen}
          onOpenPlayer={() => {
            // Expanding is a state change, not navigation: the PlayerSheet
            // mounts over whatever screen is showing.
            useStore.getState().setPlayerScreenMounted(true);
          }}
          onOpenRecording={() => {
            if (!navigationRef.isReady()) return;
            navigationRef.navigate("Recording");
          }}
          onOpenIdea={(ideaId) => {
            if (!navigationRef.isReady()) return;
            // The queue arrow jumps to the clip's home collection and highlights
            // its card — the same "view in collection" treatment as Search.
            openIdeaInCollection(navigationRef, ideaId);
          }}
        />
        <PlayerSheet
          activeRouteName={activeRouteName}
          isDrawerOpen={isDrawerOpen}
          navigateRoot={(routeName, params) => {
            if (!navigationRef.isReady()) return;
            (navigationRef.navigate as (route: string, params?: object) => void)(routeName, params);
          }}
        />
        </PlayerSheetPositionProvider>
        <ImportProgressBanner hidden={isDrawerOpen} />
        <DuplicateReviewSheet />
        <LibraryProcessHost drawerOpen={isDrawerOpen} />
      </NavigationContainer>
      <RestoreRestartGate />
      </FullPlayerProvider>
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
      await cleanupStaleDisasterRecoveryBackupFiles();
      const hydratedState = useStore.getState();
      await cleanupInterruptedDisasterRecoveryRestores(hydratedState.workspaces);
      // Permanently purge quarantined (deleted) audio past its retention window.
      await purgeExpiredTrash();
      await resumePendingWorkspaceArchiveOperations();

      // Recovery mode: if the library hydrated empty but the shadow manifest still holds
      // data, surface a restore prompt instead of silently presenting an empty, writable
      // library (the catastrophic-loss scenario). The persist + manifest guards keep the
      // manifest intact until the user recovers.
      const liveIdeaCount = hydratedState.workspaces.reduce(
        (sum, ws) => sum + ws.ideas.length,
        0
      );
      if (liveIdeaCount === 0) {
        const manifest = await readManifest();
        const manifestIdeaCount = manifest
          ? manifest.workspaces.reduce((sum, ws) => sum + (ws.ideas?.length ?? 0), 0)
          : 0;
        if (manifestIdeaCount > 0) {
          Alert.alert(
            "Restore your library?",
            `Song Seed opened with an empty library, but a backup with ${manifestIdeaCount} item${manifestIdeaCount === 1 ? "" : "s"} was found on this device. Restore it now?`,
            [
              { text: "Not now", style: "cancel" },
              {
                text: "Restore",
                onPress: () => {
                  void appActions.recoverOrphanedAudio();
                },
              },
            ]
          );
          return;
        }
      }

      const recordingRecovery = await recoverPendingRecordingSession();
      if (recordingRecovery.status === "recovered") {
        Alert.alert(
          "Recovered recording",
          `${recordingRecovery.title} was restored after the previous session ended unexpectedly.`
        );
        return;
      } else if (recordingRecovery.status === "failed") {
        Alert.alert(
          "Recording recovery failed",
          "Song Seed found an unfinished recording from the previous session but could not restore it automatically."
        );
        return;
      }

      const state = useStore.getState();
      if (
        !shouldPromptForBackupReminder({
          workspaces: state.workspaces,
          backupReminderFrequency: state.backupReminderFrequency,
          lastSuccessfulBackupAt: state.lastSuccessfulBackupAt,
        })
      ) {
        return;
      }

      markBackupReminderPromptShown();
      Alert.alert(
        "Back up your library?",
        buildBackupReminderPromptMessage({
          backupReminderFrequency: state.backupReminderFrequency,
          lastSuccessfulBackupAt: state.lastSuccessfulBackupAt,
        }),
        [
          { text: "Later", style: "cancel" },
          {
            text: "Turn Off Reminders",
            onPress: () => {
              useStore.getState().setBackupReminderFrequency("off");
            },
          },
          {
            text: "Open Backup Settings",
            onPress: () => {
              if (!navigationRef.isReady()) return;
              navigationRef.navigate("Home", { screen: "SettingsHome" });
            },
          },
        ]
      );
    })();
  }, [hasHydrated]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AudioRecorderProvider>
          <AppDialogHost />
          {!hasHydrated ? (
            // Hold the app shell until persist rehydrates so no screen can mount against the
            // default store and accidentally serialize an empty snapshot back to AsyncStorage.
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#FDFBF7",
              }}
            >
              <ActivityIndicator color="#B87D6B" />
            </View>
          ) : (
            <AppContent />
          )}
        </AudioRecorderProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
