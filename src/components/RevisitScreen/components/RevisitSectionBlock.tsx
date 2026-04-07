import React from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "../../../styles";
import type { SongIdea } from "../../../types";
import type { RevisitCandidate, RevisitSection } from "../../../revisit";
import { revisitStyles } from "../styles";
import { RevisitCandidateCard } from "./RevisitCandidateCard";

type RevisitSectionBlockProps = {
  section: RevisitSection;
  getCandidateStatus: (candidate: RevisitCandidate) => SongIdea["status"] | null;
  isCandidateActive: (candidate: RevisitCandidate) => boolean;
  isCandidatePlaying: (candidate: RevisitCandidate) => boolean;
  inlinePositionMs: number;
  inlineDurationMs: number;
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
  inlinePositionMs,
  inlineDurationMs,
  onTogglePlay,
  onStopPlay,
  onSeekStart,
  onSeek,
  onSeekCancel,
  onOpen,
  onOpenMenu,
  onOpenSection,
}: RevisitSectionBlockProps) {
  const count = section.totalCount ?? section.items.length;

  return (
    <View style={revisitStyles.sectionWrap}>
      <View style={revisitStyles.sectionHeader}>
        <View style={revisitStyles.sectionHeaderCopy}>
          <View style={revisitStyles.sectionHeaderMain}>
            <Text style={revisitStyles.sectionTitle}>{section.title}</Text>
          {section.actionLabel && onOpenSection ? (
            <Pressable
              style={({ pressed }) => [
                revisitStyles.sectionActionButton,
                pressed ? styles.pressDown : null,
                ]}
                onPress={onOpenSection}
              >
                <Text style={revisitStyles.sectionActionText}>{section.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
          {section.subtitle ? (
            <Text style={revisitStyles.sectionSubtitle}>{section.subtitle}</Text>
          ) : null}
        </View>
        <View style={revisitStyles.sectionCountPill}>
          <Text style={revisitStyles.sectionCountPillText}>{count}</Text>
        </View>
      </View>

      {section.items.length === 0 ? (
        <View style={[styles.card, revisitStyles.emptyCard]}>
          <Text style={styles.cardTitle}>{section.emptyTitle}</Text>
        </View>
      ) : (
        <View style={styles.listContent}>
          {section.items.map(({ candidate, reason }) => (
            <RevisitCandidateCard
              key={`${section.key}:${candidate.key}`}
              candidate={candidate}
              reason={reason}
              showReason={section.key !== "around"}
              status={getCandidateStatus(candidate)}
              isActive={isCandidateActive(candidate)}
              isPlaying={isCandidatePlaying(candidate)}
              inlinePositionMs={inlinePositionMs}
              inlineDurationMs={inlineDurationMs}
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
      )}
    </View>
  );
}
