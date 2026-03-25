import type { LibraryExportFormat } from "../../services/libraryExport";
import type { Collection, Workspace } from "../../types";
import { getCollectionScopeIds } from "../../utils";
import type {
  ArchiveExportOptions,
  CollectionSelectionState,
  SettingsSelectionSummary,
  StandardExportOptions,
} from "./types";

export function getCollectionSelectionState(
  workspace: Workspace,
  collection: Collection,
  selectedWorkspaceIds: string[],
  selectedCollectionIds: string[],
  excludedCollectionIds: string[]
): CollectionSelectionState {
  if (excludedCollectionIds.includes(collection.id)) {
    return "excluded";
  }

  let currentParentId = collection.parentCollectionId ?? null;
  while (currentParentId) {
    if (excludedCollectionIds.includes(currentParentId)) {
      return "excluded";
    }

    if (selectedCollectionIds.includes(currentParentId)) {
      return "inherited";
    }

    currentParentId =
      workspace.collections.find((candidate) => candidate.id === currentParentId)?.parentCollectionId ?? null;
  }

  if (selectedWorkspaceIds.includes(workspace.id)) {
    return "inherited";
  }

  if (selectedCollectionIds.includes(collection.id)) {
    return "selected";
  }

  return "unselected";
}

export function countCollectionIdeas(
  workspace: Workspace,
  collectionId: string,
  includeHiddenItems: boolean
) {
  const collectionIds = new Set<string>([collectionId]);
  workspace.collections.forEach((collection) => {
    if (collection.parentCollectionId === collectionId) {
      collectionIds.add(collection.id);
    }
  });

  return workspace.ideas.filter((idea) => {
    if (!collectionIds.has(idea.collectionId)) {
      return false;
    }

    if (includeHiddenItems) {
      return true;
    }

    const collection = workspace.collections.find((candidate) => candidate.id === idea.collectionId);
    return !collection?.ideasListState.hiddenIdeaIds.includes(idea.id);
  }).length;
}

export function countWorkspaceIdeas(workspace: Workspace, includeHiddenItems: boolean) {
  if (includeHiddenItems) {
    return workspace.ideas.length;
  }

  return workspace.ideas.filter((idea) => {
    const collection = workspace.collections.find((candidate) => candidate.id === idea.collectionId);
    return !collection?.ideasListState.hiddenIdeaIds.includes(idea.id);
  }).length;
}

export function getSelectionSummary({
  workspaces,
  selectedWorkspaceIds,
  selectedCollectionIds,
  excludedCollectionIds,
  includeHiddenItems,
}: {
  workspaces: Workspace[];
  selectedWorkspaceIds: string[];
  selectedCollectionIds: string[];
  excludedCollectionIds: string[];
  includeHiddenItems: boolean;
}): SettingsSelectionSummary {
  const workspaceIdSet = new Set(selectedWorkspaceIds);
  const collectionIdSet = new Set(selectedCollectionIds);
  const excludedCollectionIdSet = new Set(excludedCollectionIds);
  let exportableIdeaCount = 0;
  let selectedCollectionCount = 0;
  const workspaceCollectionCounts: Record<string, number> = {};

  workspaces.forEach((workspace) => {
    const effectiveCollectionIds = new Set<string>();

    if (workspaceIdSet.has(workspace.id)) {
      workspace.collections.forEach((collection) => effectiveCollectionIds.add(collection.id));
    }

    workspace.collections.forEach((collection) => {
      if (!collectionIdSet.has(collection.id)) {
        return;
      }

      effectiveCollectionIds.add(collection.id);
      workspace.collections.forEach((candidate) => {
        if (candidate.parentCollectionId === collection.id) {
          effectiveCollectionIds.add(candidate.id);
        }
      });
    });

    workspace.collections.forEach((collection) => {
      if (!excludedCollectionIdSet.has(collection.id)) {
        return;
      }

      getCollectionScopeIds(workspace, collection.id).forEach((id: string) =>
        effectiveCollectionIds.delete(id)
      );
    });

    selectedCollectionCount += effectiveCollectionIds.size;
    workspaceCollectionCounts[workspace.id] = effectiveCollectionIds.size;

    workspace.ideas.forEach((idea) => {
      if (!effectiveCollectionIds.has(idea.collectionId)) {
        return;
      }

      if (includeHiddenItems) {
        exportableIdeaCount += 1;
        return;
      }

      const collection = workspace.collections.find((candidate) => candidate.id === idea.collectionId);
      if (!collection?.ideasListState.hiddenIdeaIds.includes(idea.id)) {
        exportableIdeaCount += 1;
      }
    });
  });

  return {
    selectedWorkspaceCount: workspaceIdSet.size,
    selectedCollectionCount,
    exportableIdeaCount,
    workspaceCollectionCounts,
  };
}

export function buildWarningSummary(warnings: string[]) {
  const uniqueWarnings = Array.from(new Set(warnings));
  const preview = uniqueWarnings.slice(0, 3).join("\n");
  const remainder =
    uniqueWarnings.length > 3
      ? `\n+ ${uniqueWarnings.length - 3} more warning${uniqueWarnings.length - 3 === 1 ? "" : "s"}.`
      : "";
  return `${preview}${remainder}`;
}

export function getFormatSummary(format: LibraryExportFormat) {
  return format === "song-seed-archive" ? "Song Seed Archive" : "Standard ZIP";
}

export function getOptionsSummary(
  format: LibraryExportFormat | null,
  archiveOptions: ArchiveExportOptions,
  standardOptions: StandardExportOptions
) {
  if (!format) {
    return "";
  }

  const options =
    format === "song-seed-archive"
      ? [
          archiveOptions.includeFullSongHistory ? "history" : null,
          archiveOptions.includeNotes ? "notes" : null,
          archiveOptions.includeLyrics ? "lyrics" : null,
          archiveOptions.includeHiddenItems ? "hidden" : null,
        ]
      : [
          standardOptions.includeNotesAsText ? "notes" : null,
          standardOptions.includeLyricsAsText ? "lyrics" : null,
          standardOptions.includeHiddenItems ? "hidden" : null,
        ];

  const enabled = options.filter((value): value is string => Boolean(value));
  if (enabled.length === 0) {
    return "basic export";
  }

  return enabled.join(", ");
}
