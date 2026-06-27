import type { IdeaSortMetric } from "../../ideaSort";
import type {
  ClipClipboard,
  ClipVersion,
  Collection,
  IdeaSort,
  IdeasTimelineMetric,
  InlinePlayerControls,
  SongIdea,
} from "../../types";
import type { MutableRefObject, ReactNode } from "react";
import type { Animated } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import type { ImportedAudioAsset } from "../../services/audioStorage";
import type { HierarchyLevel } from "../../hierarchy";

/** One node in a collection's hierarchy path, rendered as the quiet `A › B › C`
 * eyebrow above a collection. (Formerly powered the removed AppBreadcrumbs pill.) */
export type AppBreadcrumbItem = {
  key: string;
  label: string;
  level: HierarchyLevel;
  onPress?: () => void;
  active?: boolean;
  iconOnly?: boolean;
};

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

export type IdeaListItemMeta = {
  playClip: ClipVersion | null;
  clipDurationLabel: string;
  projectPrimaryDurationLabel: string;
  projectClipCount: number;
  hasProjectLyrics: boolean;
  hasProjectClipCount: boolean;
  hasExpandedProjectIndicators: boolean;
  createdAtLabel: string;
  updatedAtLabel: string;
  projectProgressPct: number | null;
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

export type CollectionListModel = {
  listRef?: MutableRefObject<any>;
  listEntries: IdeaListEntry[];
  itemMetaByIdeaId: Map<string, IdeaListItemMeta>;
  topContent?: ReactNode;
  listDensity: "comfortable" | "compact";
  showDateDividers: boolean;
  listFooterSpacerHeight: number;
  searchNeedle: string;
  ideasSort: IdeaSort;
  activeTimelineMetric: "created" | "updated" | null;
  activeSortMetric: IdeaSortMetric;
  lyricsFilterMode: "all" | "with" | "without";
  inlinePlayer: InlinePlayerControls;
  rowLayoutsRef: MutableRefObject<Record<string, { y: number; height: number }>>;
  highlightMapRef: MutableRefObject<Record<string, Animated.Value>>;
  viewabilityConfig: { itemVisiblePercentThreshold: number };
  searchMetaByIdeaId: Map<string, { matches: boolean; title: boolean; notes: boolean; lyrics: boolean }>;
  onViewableItemsChanged: (info: { viewableItems: Array<{ item: IdeaListEntry }> }) => void;
  onItemCellLayout?: (key: string, y: number) => void;
  playIdeaFromList: (ideaId: string, clip: any) => Promise<void> | void;
  openIdeaFromList: (ideaId: string, clip: any) => Promise<void> | void;
  unhideIdeasFromList: (ideaIds: string[]) => void;
  hideTimelineDay: (metric: "created" | "updated", dayStartTs: number) => Promise<void>;
  unhideTimelineDay: (metric: "created" | "updated", dayStartTs: number) => void;
  /** UI-thread scroll offset mirrored from the list — drives the collapsing header. */
  collapseScrollY?: SharedValue<number>;
  /** Top inset reserving space for the absolute collapsing header overlay. */
  contentPaddingTop?: number;
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
