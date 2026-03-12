import { SongIdea, IdeasTimelineMetric } from "../../types";

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
