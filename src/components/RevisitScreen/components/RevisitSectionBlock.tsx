import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import type { SongIdea } from "../../../types";
import type { RevisitCandidate, RevisitSection, RevisitSectionKey } from "../../../revisit";
import { revisitStyles } from "../styles";
import { RevisitCandidateCard } from "./RevisitCandidateCard";

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
  onOpenSection,
}: RevisitSectionBlockProps) {
  const items = section.items.slice(0, MAX_ITEMS_PER_SECTION);

  return (
    <View style={revisitStyles.sectionWrap}>
      <View style={revisitStyles.sectionHeader}>
        <View style={revisitStyles.sectionHeaderCol}>
          <View style={revisitStyles.sectionTitleRow}>
            <Ionicons name={SECTION_ICONS[section.key]} size={16} color="#B87D6B" />
            <Text style={revisitStyles.sectionTitleSerif}>{section.title}</Text>
          </View>
          <Text style={revisitStyles.sectionSubShort}>{section.subtitle}</Text>
        </View>
        {section.actionLabel && onOpenSection ? (
          <Pressable
            style={({ pressed }) => [revisitStyles.sectionGoBtn, pressed ? styles.pressDown : null]}
            onPress={onOpenSection}
            hitSlop={6}
          >
            <Text style={revisitStyles.sectionGoText}>{section.actionLabel} ›</Text>
          </Pressable>
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
          />
        ))}
      </View>
    </View>
  );
}
