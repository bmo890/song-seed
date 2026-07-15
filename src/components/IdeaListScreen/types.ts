import type { IdeaSortMetric } from "../../ideaSort";
import type {
  ClipVersion,
  IdeaSort,
  IdeasTimelineMetric,
  InlinePlayerControls,
  SongIdea,
} from "../../types";
import type { MutableRefObject, ReactNode } from "react";
import type { Animated } from "react-native";
import type { SharedValue } from "react-native-reanimated";

export type IdeaListEntry =
  | {
      key: string;
      type: "idea";
      idea: SongIdea;
      dayDividerLabel?: string | null;
      dayStartTs?: number | null;
    }
  | {
      /** A folded day group. Renders a labelled marker in place of its items;
       *  tap to expand. Carries the count of items tucked inside. */
      key: string;
      type: "collapsedDay";
      label: string;
      dayStartTs: number;
      count: number;
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
  hideTimelineDay: (metric: "created" | "updated", dayStartTs: number) => Promise<void>;
  /** Expand a previously-collapsed day group back into the list. */
  expandTimelineDay: (metric: "created" | "updated", dayStartTs: number) => void;
  /** UI-thread scroll offset mirrored from the list — drives the collapsing header. */
  collapseScrollY?: SharedValue<number>;
  /** Top inset reserving space for the absolute collapsing header overlay. */
  contentPaddingTop?: number;
};
