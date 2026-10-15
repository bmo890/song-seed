import React from "react";
import { Text, View } from "react-native";
import { Press } from "../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import type { SongIdea } from "../../../types";
import type { RevisitCandidate, RevisitSection, RevisitSectionKey } from "../../../domain/revisit";
import { revisitStyles } from "../styles";
import { RevisitCandidateCard } from "./RevisitCandidateCard";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

// A section's name says what it holds and each card says why it is there, so
// only "Around this time" keeps a subtitle: its name alone could mean the hour
// (subtitle audit, 2026-10-15).
const SECTION_COPY: Record<string, { title: string; subtitle?: string }> = {
  pickup: { title: "revisit.unfinished" },
  forgotten: { title: "revisit.rawIdeas" },
  vault: { title: "revisit.deepCuts" },
  around: { title: "revisit.around", subtitle: "revisit.aroundSubtitle" },
};

// A daily feature: one idea per section, two at most.
const MAX_ITEMS_PER_SECTION = 2;

// A quiet leading glyph per section, mirrored on the Customize "What to surface"
// toggles so the two pages read as the same taxonomy.
export const SECTION_ICONS: Record<RevisitSectionKey, React.ComponentProps<typeof Ionicons>["name"]> = {
  pickup: "hourglass-outline",
  forgotten: "leaf-outline",
  vault: "albums-outline",
  around: "calendar-outline",
};

type RevisitSectionBlockProps = {
  section: RevisitSection;
  getCandidateStatus: (candidate: RevisitCandidate) => SongIdea["status"] | null;
  isCandidateActive: (candidate: RevisitCandidate) => boolean;
  isCandidatePlaying: (candidate: RevisitCandidate) => boolean;
  onTogglePlay: (candidate: RevisitCandidate) => void;
  onStopPlay: () => void;
  onSeekStart: () => void;
  onSeek: (ms: number) => void;
  onSeekCancel: () => void;
  onOpen: (candidate: RevisitCandidate) => void;
  onOpenMenu: (candidate: RevisitCandidate) => void;
  onViewInCollection: (candidate: RevisitCandidate) => void;
  onOpenSection?: () => void;
};

export function RevisitSectionBlock({
  section,
  getCandidateStatus,
  isCandidateActive,
  isCandidatePlaying,
  onTogglePlay,
  onStopPlay,
  onSeekStart,
  onSeek,
  onSeekCancel,
  onOpen,
  onOpenMenu,
  onViewInCollection,
  onOpenSection,
}: RevisitSectionBlockProps) {
  const { t } = useTranslation();
  const items = section.items.slice(0, MAX_ITEMS_PER_SECTION);
  const copy = SECTION_COPY[section.key];

  return (
    <View style={revisitStyles.sectionWrap}>
      <View style={revisitStyles.sectionHeader}>
        <View style={revisitStyles.sectionHeaderCol}>
          <View style={revisitStyles.sectionTitleRow}>
            <Ionicons name={SECTION_ICONS[section.key]} size={16} color={colors.textSecondary} />
            <Text style={revisitStyles.sectionTitleSerif}>{t(copy.title)}</Text>
          </View>
          {copy.subtitle ? <Text style={revisitStyles.sectionSubShort}>{t(copy.subtitle)}</Text> : null}
        </View>
        {section.actionLabel && onOpenSection ? (
          <Press
            haptic="none"
            style={revisitStyles.sectionGoBtn}
            onPress={onOpenSection}
            hitSlop={6}
          >
            <Text style={revisitStyles.sectionGoText}>{t("revisit.seeSnapshot")} ›</Text>
          </Press>
        ) : null}
      </View>

      <View style={revisitStyles.feedList}>
        {items.map(({ candidate, reason }) => (
          <RevisitCandidateCard
            key={candidate.key}
            candidate={candidate}
            reason={reason}
            status={getCandidateStatus(candidate)}
            isActive={isCandidateActive(candidate)}
            isPlaying={isCandidatePlaying(candidate)}
            onOpen={() => onOpen(candidate)}
            onTogglePlay={() => onTogglePlay(candidate)}
            onStopPlay={onStopPlay}
            onSeekStart={onSeekStart}
            onSeek={onSeek}
            onSeekCancel={onSeekCancel}
            onOpenMenu={() => onOpenMenu(candidate)}
            onViewInCollection={() => onViewInCollection(candidate)}
          />
        ))}
      </View>
    </View>
  );
}
