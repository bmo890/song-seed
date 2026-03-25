import { useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import type { AppBreadcrumbItem } from "../../common/AppBreadcrumbs";
import { useStore } from "../../../state/useStore";
import { getCollectionAncestors, getCollectionById } from "../../../utils";
import { getCollectionHierarchyLevel } from "../../../hierarchy";
import { openCollectionFromContext } from "../../../navigation";

export function useLyricsScreenModel() {
  const navigation = useNavigation<any>();
  const selectedIdeaId = useStore((state) => state.selectedIdeaId);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const workspaces = useStore((state) => state.workspaces);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces]
  );
  const projectIdea = useMemo(() => {
    const idea = activeWorkspace?.ideas.find((candidate) => candidate.id === selectedIdeaId) ?? null;
    return idea?.kind === "project" ? idea : null;
  }, [activeWorkspace, selectedIdeaId]);
  const projectCollection = useMemo(
    () => (activeWorkspace && projectIdea ? getCollectionById(activeWorkspace, projectIdea.collectionId) : null),
    [activeWorkspace, projectIdea]
  );
  const projectCollectionAncestors = useMemo(
    () =>
      activeWorkspace && projectCollection
        ? getCollectionAncestors(activeWorkspace, projectCollection.id)
        : [],
    [activeWorkspace, projectCollection]
  );
  const versionCount = projectIdea?.lyrics?.versions.length ?? 0;

  const breadcrumbItems = useMemo<AppBreadcrumbItem[]>(() => {
    if (!activeWorkspace || !projectCollection || !projectIdea) return [];

    return [
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
        onPress: () =>
          openCollectionFromContext(navigation, {
            collectionId: collection.id,
            source: "detail" as const,
          }),
      })),
      {
        key: projectCollection.id,
        label: projectCollection.title,
        level: getCollectionHierarchyLevel(projectCollection),
        onPress: () =>
          openCollectionFromContext(navigation, {
            collectionId: projectCollection.id,
            source: "detail",
          }),
      },
      {
        key: projectIdea.id,
        label: projectIdea.title,
        level: "song",
        onPress: () => navigation.navigate("IdeaDetail", { ideaId: projectIdea.id }),
      },
      {
        key: "lyrics",
        label: "Lyrics",
        level: "lyrics",
        active: true,
      },
    ];
  }, [activeWorkspace, navigation, projectCollection, projectCollectionAncestors, projectIdea]);

  return {
    projectIdea,
    versionCount,
    breadcrumbItems,
  };
}
