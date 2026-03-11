import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { useStore } from "../../state/useStore";
import { getCollectionAncestors, getCollectionById } from "../../utils";
import { getCollectionHierarchyLevel } from "../../hierarchy";
import { LyricsVersionsPanel } from "./LyricsVersionsPanel";

export function LyricsScreen() {
  const navigation = useNavigation<any>();
  const selectedIdeaId = useStore((s) => s.selectedIdeaId);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);

  const selectedIdea = useStore((s) => {
    const workspace = s.workspaces.find((item) => item.id === activeWorkspaceId);
    return workspace?.ideas.find((idea) => idea.id === selectedIdeaId) ?? null;
  });
  const activeWorkspace = useStore((s) => s.workspaces.find((item) => item.id === activeWorkspaceId) ?? null);

  if (!selectedIdea || selectedIdea.kind !== "project") {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader title="Lyrics" leftIcon="back" />
        <Text style={styles.emptyText}>Lyrics are only available inside a song.</Text>
        <ExpoStatusBar style="dark" />
      </SafeAreaView>
    );
  }

  const projectCollection =
    activeWorkspace ? getCollectionById(activeWorkspace, selectedIdea.collectionId) : null;
  const projectCollectionAncestors =
    projectCollection && activeWorkspace ? getCollectionAncestors(activeWorkspace, projectCollection.id) : [];
  const versionCount = selectedIdea.lyrics?.versions.length ?? 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title="Lyrics"
        leftIcon="back"
        rightElement={
          <View style={styles.contextPill}>
            <Ionicons name="book-outline" size={12} color="#4b5563" />
            <Text style={styles.contextPillText}>{versionCount} {versionCount === 1 ? "PAGE" : "PAGES"}</Text>
          </View>
        }
      />

      {activeWorkspace && projectCollection ? (
        <AppBreadcrumbs
          items={[
            {
              key: "home",
              label: "Home",
              level: "home",
              iconOnly: true,
              onPress: () => navigation.navigate("Home", { screen: "Workspaces" }),
            },
            {
              key: `workspace-${activeWorkspace.id}`,
              label: activeWorkspace.title,
              level: "workspace",
              onPress: () => navigation.navigate("Home", { screen: "Browse" }),
            },
            ...projectCollectionAncestors.map((collection) => ({
              key: collection.id,
              label: collection.title,
              level: getCollectionHierarchyLevel(collection),
              onPress: () => navigation.navigate("CollectionDetail", { collectionId: collection.id }),
            })),
            {
              key: projectCollection.id,
              label: projectCollection.title,
              level: getCollectionHierarchyLevel(projectCollection),
              onPress: () => navigation.navigate("CollectionDetail", { collectionId: projectCollection.id }),
            },
            {
              key: selectedIdea.id,
              label: selectedIdea.title,
              level: "song",
              onPress: () => navigation.navigate("IdeaDetail", { ideaId: selectedIdea.id }),
            },
            {
              key: "lyrics",
              label: "Lyrics",
              level: "lyrics",
              active: true,
            },
          ]}
        />
      ) : null}

      <Text style={styles.subtitle}>{selectedIdea.title}</Text>

      <ScrollView contentContainerStyle={styles.lyricsScreenContent}>
        <LyricsVersionsPanel projectIdea={selectedIdea} />
      </ScrollView>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
