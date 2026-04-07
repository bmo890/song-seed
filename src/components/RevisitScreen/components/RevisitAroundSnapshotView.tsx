import React from "react";
import { Pressable, Text, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { styles } from "../../../styles";
import type { SongIdea } from "../../../types";
import type { RevisitAroundSnapshot, RevisitCandidate } from "../../../revisit";
import { revisitStyles } from "../styles";
import { RevisitCandidateCard } from "./RevisitCandidateCard";

type RevisitAroundSnapshotViewProps = {
  snapshot: RevisitAroundSnapshot;
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
  onOpenInActivity: () => void;
};

export function RevisitAroundSnapshotView({
  snapshot,
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
  onOpenInActivity,
}: RevisitAroundSnapshotViewProps) {
  return (
    <View style={revisitStyles.snapshotList}>
      <PageIntro
        title={snapshot.title}
        subtitle={snapshot.subtitle}
      />

      <View style={[styles.card, revisitStyles.snapshotHeaderCard]}>
        <View style={revisitStyles.snapshotHeaderTopRow}>
          <Text style={revisitStyles.snapshotWindowText}>{snapshot.windowLabel}</Text>
          <Pressable
            style={({ pressed }) => [
              revisitStyles.sectionActionButton,
              pressed ? styles.pressDown : null,
            ]}
            onPress={onOpenInActivity}
          >
            <Text style={revisitStyles.sectionActionText}>Open in Activity</Text>
          </Pressable>
        </View>
        <Text style={styles.settingsSectionMeta}>
          {snapshot.items.length} item{snapshot.items.length === 1 ? "" : "s"}
        </Text>
      </View>

      {snapshot.items.length === 0 ? (
        <View style={[styles.card, revisitStyles.emptyStateCard]}>
          <Text style={styles.cardTitle}>Nothing seasonal right now</Text>
        </View>
      ) : (
        snapshot.items.map(({ candidate, reason }) => (
          <RevisitCandidateCard
            key={`around-snapshot:${candidate.key}`}
            candidate={candidate}
            reason={reason}
            showReason={false}
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
        ))
      )}
    </View>
  );
}
