import { SongIdea, IdeasTimelineMetric, ClipClipboard, Collection, IdeaSort } from "../../types";
import type { IdeaSortMetric } from "../../ideaSort";
import type { InlinePlayer } from "../../types";
import type { MutableRefObject } from "react";
import type { Animated } from "react-native";
import type { ImportedAudioAsset } from "../../services/audioStorage";
import type { AppBreadcrumbItem } from "../common/AppBreadcrumbs";

export type IdeaListEntry =
  | {
      key: string;
      type: "idea";
      idea: SongIdea;
      hidden: boolean;
      dayDividerLabel?: string | null;
      dayStartTs?: number | null;
    }
  | {
      key: string;
      type: "hidden-day";
      dayLabel: string;
      dayDividerLabel: string;
      dayStartTs: number;
      metric: IdeasTimelineMetric;
      hiddenCount: number;
    };

export type CollectionHeaderModel = {
  showBack: boolean;
  headerMenuOpen: boolean;
  title: string;
  workspaceTitle: string;
  breadcrumbs: AppBreadcrumbItem[];
  currentCollection: Collection;
  ideasHeaderMeta: string;
  searchQuery: string;
  hasActivityRangeFilter: boolean;
  activityLabel?: string;
  collectionId: string;
  clipClipboard: ClipClipboard | null;
  duplicateWarningText: string;
  onToggleHeaderMenu: () => void;
  onSearchQueryChange: (value: string) => void;
  onClearActivityRange: () => void;
  onPasteClipboard: () => void;
  onCancelClipboard: () => void;
  onBack?: () => void;
};

export type CollectionFilterModel = {
  selectedProjectStages: Array<"seed" | "sprout" | "semi" | "song">;
  lyricsFilterMode: "all" | "with" | "without";
  showDateDividers: boolean;
  stickyDayLabel: string | null;
  stickyDayTop: number;
  hiddenItemsCount: number;
  nestedCollectionsExpanded: boolean;
  childCollections: Collection[];
  onStickyLayout: (top: number) => void;
  onToggleProjectStage: (stage: "seed" | "sprout" | "semi" | "song") => void;
  onClearProjectStages: () => void;
  onLyricsFilterModeChange: (mode: "all" | "with" | "without") => void;
  onUnhideAll: () => void;
  onToggleNestedCollections: () => void;
  onOpenNestedCollection: (collectionId: string) => void;
  onOpenNestedCollectionActions: (collectionId: string) => void;
};

export type CollectionListModel = {
  listRef?: MutableRefObject<any>;
  listSelectionMode: boolean;
  allowReorder: boolean;
  listEntries: IdeaListEntry[];
  listDensity: "comfortable" | "compact";
  showDateDividers: boolean;
  listFooterSpacerHeight: number;
  searchNeedle: string;
  ideasSort: IdeaSort;
  activeTimelineMetric: "created" | "updated" | null;
  activeSortMetric: IdeaSortMetric;
  hoveredIdeaId: string | null;
  dropIntent: "between" | "inside";
  ideaSizeMap: Record<string, number>;
  lyricsFilterMode: "all" | "with" | "without";
  inlinePlayer: InlinePlayer;
  rowLayoutsRef: MutableRefObject<Record<string, { y: number; height: number }>>;
  highlightMapRef: MutableRefObject<Record<string, Animated.Value>>;
  viewabilityConfig: { itemVisiblePercentThreshold: number };
  searchMetaByIdeaId: Map<string, { matches: boolean; title: boolean; notes: boolean; lyrics: boolean }>;
  onViewableItemsChanged: (info: { viewableItems: Array<{ item: IdeaListEntry }> }) => void;
  playIdeaFromList: (ideaId: string, clip: any) => Promise<void> | void;
  openIdeaFromList: (ideaId: string, clip: any) => Promise<void> | void;
  unhideIdeasFromList: (ideaIds: string[]) => void;
  hideTimelineDay: (metric: "created" | "updated", dayStartTs: number) => Promise<void>;
  unhideTimelineDay: (metric: "created" | "updated", dayStartTs: number) => void;
  setHoveredIdeaId: (ideaId: string | null) => void;
  onReorderIdeas: (args: {
    items: SongIdea[];
    from: number;
    to: number;
    sourceId?: string;
    targetId?: string;
    intent: "between";
  }) => void;
  onScroll?: (e: any) => void;
  scrollEventThrottle?: number;
};

export type CollectionImportModel = {
  importModalOpen: boolean;
  importAssets: ImportedAudioAsset[];
  importMode: "single-clip" | "song-project" | null;
  importDatePreference: "import" | "source";
  importDraft: string;
  globalCustomTags?: never;
  openImportAudioFlow: () => Promise<void>;
  resetImportModal: () => void;
  saveImportedAudio: () => Promise<void>;
  setImportDraft: (value: string) => void;
  setImportModalOpen: (open: boolean) => void;
  setImportAssets: (assets: ImportedAudioAsset[]) => void;
  setImportMode: (mode: "single-clip" | "song-project" | null) => void;
  setImportDatePreference: (preference: "import" | "source") => void;
};
