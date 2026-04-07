import React from "react";
import type { NavigationProp } from "@react-navigation/native";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import type { ClipVersion, Collection, SongIdea, Workspace } from "../../types";
import { getCollectionHierarchyLevel, getIdeaHierarchyLevel } from "../../hierarchy";
import { openCollectionFromContext, openWorkspaceBrowseRoot } from "../../navigation";

type EditorHeaderSectionProps = {
  navigation: NavigationProp<any>;
  activeWorkspace: Workspace | null;
  targetCollection: Collection | null;
  targetCollectionAncestors: Collection[];
  sourceClip: ClipVersion | null;
  targetIdea: SongIdea | null;
  onBack: () => void;
};

export function EditorHeaderSection({
  navigation,
  activeWorkspace,
  targetCollection,
  targetCollectionAncestors,
  sourceClip,
  targetIdea,
  onBack,
}: EditorHeaderSectionProps) {
  return (
    <>
      <ScreenHeader title="Audio Editor" leftIcon="back" onLeftPress={onBack} />
      {activeWorkspace && targetCollection && sourceClip && targetIdea ? (
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
              onPress: () => openWorkspaceBrowseRoot(navigation),
            },
            ...targetCollectionAncestors.map((collection) => ({
              key: collection.id,
              label: collection.title,
              level: getCollectionHierarchyLevel(collection),
              onPress: () =>
                openCollectionFromContext(navigation, {
                  collectionId: collection.id,
                  source: "detail",
                }),
            })),
            {
              key: targetCollection.id,
              label: targetCollection.title,
              level: getCollectionHierarchyLevel(targetCollection),
              onPress: () =>
                openCollectionFromContext(navigation, {
                  collectionId: targetCollection.id,
                  source: "detail",
                }),
            },
            ...(targetIdea.kind === "project"
              ? [
                  {
                    key: targetIdea.id,
                    label: targetIdea.title,
                    level: getIdeaHierarchyLevel(targetIdea),
                    onPress: () => navigation.navigate("IdeaDetail", { ideaId: targetIdea.id }),
                  },
                ]
              : []),
            {
              key: sourceClip.id,
              label: sourceClip.title,
              level: "clip" as const,
              active: true,
            },
          ]}
        />
      ) : null}
    </>
  );
}
