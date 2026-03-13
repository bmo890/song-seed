import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator, DrawerContentComponentProps } from "@react-navigation/drawer";
import { AudioRecorderProvider } from "@siteed/expo-audio-studio";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
import { getCollectionById } from "./src/utils";

export type RootStackParamList = {
  Home: undefined;
  IdeaDetail: { ideaId?: string; startInEdit?: boolean } | undefined;
  CollectionDetail:
    | {
        collectionId: string;
        activityRangeStartTs?: number;
        activityRangeEndTs?: number;
        activityMetricFilter?: "created" | "updated" | "both";
        activityLabel?: string;
      }
    | undefined;
  Activity: { workspaceId?: string; collectionId?: string } | undefined;
  Recording: undefined;
  Player: undefined;
  Tuner: undefined;
  Metronome: undefined;
  Editor: { ideaId: string; clipId: string; audioUri?: string; durationMs?: number };
  Lyrics: { ideaId: string };
  LyricsVersion: { ideaId: string; versionId?: string; startInEdit?: boolean; forceNewVersion?: boolean; createDraft?: boolean };
};
import { useStore } from "./src/state/useStore";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator();

function DrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const selectedIdeaId = useStore((s) => s.selectedIdeaId);
  const playerTarget = useStore((s) => s.playerTarget);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const rootNavigation = (navigation as any).getParent?.();
  const navigateRoot = (route: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(route as never, params as never);
  const deepestRoute = getDeepestRoute((rootNavigation ?? navigation).getState?.() ?? state);
  const deepestRouteName = deepestRoute.name;
  const deepestParams = deepestRoute.params ?? {};
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

  const routeIdeaId =
    deepestRouteName === "IdeaDetail" ||
    deepestRouteName === "Editor" ||
    deepestRouteName === "Lyrics" ||
    deepestRouteName === "LyricsVersion"
      ? (deepestParams.ideaId as string | undefined) ?? selectedIdeaId
      : deepestRouteName === "Player"
        ? playerTarget?.ideaId ?? selectedIdeaId
        : selectedIdeaId;

  const routeIdea =
    routeIdeaId && activeWorkspace
      ? activeWorkspace.ideas.find((idea) => idea.id === routeIdeaId) ?? null
      : null;
  const currentCollectionId =
    (deepestParams.collectionId as string | undefined) ??
    routeIdea?.collectionId ??
    null;
  const currentCollection =
    currentCollectionId && activeWorkspace ? getCollectionById(activeWorkspace, currentCollectionId) : null;
  const expandedParentCollectionId = currentCollection?.parentCollectionId ?? currentCollection?.id ?? null;
  const sidebarCollections =
    activeWorkspace?.collections
      .filter((collection) => !collection.parentCollectionId)
      .flatMap((collection) => {
        const base = [{
          id: collection.id,
          title: collection.title,
          level: "collection" as const,
          active: collection.id === currentCollection?.id,
        }];

        if (collection.id !== expandedParentCollectionId) {
          return base;
        }

        const children = activeWorkspace.collections
          .filter((candidate) => candidate.parentCollectionId === collection.id)
          .map((candidate) => ({
            id: candidate.id,
            title: candidate.title,
            level: "subcollection" as const,
            nested: true,
            active: candidate.id === currentCollection?.id,
          }));

        return [...base, ...children];
      }) ?? [];

  const closeDrawer = () => {
    navigation.closeDrawer();
  };

  return (
    <SideNav
      currentRoute={currentRoute}
      workspaceTitle={activeWorkspace?.title ?? null}
      collections={sidebarCollections}
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
        navigateRoot("CollectionDetail", { collectionId });
      }}
      onClose={() => {
        closeDrawer();
      }}

    />
  );
}

function DrawerRoutes() {
  return (
    <Drawer.Navigator
      screenOptions={{ headerShown: false }}
      drawerContent={(props) => <DrawerContent {...props} />}
      initialRouteName="Workspaces"
    >
      <Drawer.Screen name="Workspaces" component={WorkspaceListScreen} />
      <Drawer.Screen name="Browse" component={WorkspaceBrowseScreen} />
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

  const syncActiveRouteName = () => {
    const rootState = navigationRef.getRootState();
    if (!rootState) return;
    const nextRoute = getDeepestRoute(rootState).name;
    setActiveRouteName((prev) => (prev === nextRoute ? prev : nextRoute));
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={syncActiveRouteName}
      onStateChange={syncActiveRouteName}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Home">
        <Stack.Screen name="Home" component={DrawerRoutes} />
        <Stack.Screen name="CollectionDetail" component={IdeaListScreen} />
        <Stack.Screen name="Activity" component={ActivityScreen} />
        <Stack.Screen name="IdeaDetail" component={IdeaDetailScreen} />
        <Stack.Screen name="Recording" component={RecordingScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} />
        <Stack.Screen name="Tuner" component={TunerScreen} />
        <Stack.Screen name="Metronome" component={MetronomeScreen} />
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
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AudioRecorderProvider>
          <AppContent />
        </AudioRecorderProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
