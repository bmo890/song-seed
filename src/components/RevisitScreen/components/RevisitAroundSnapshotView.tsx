import React from "react";
import { Text, View } from "react-native";
import { InkLink } from "../../common/InkLink";
import type { SongIdea } from "../../../types";
import type { RevisitAroundSnapshot, RevisitCandidate } from "../../../domain/revisit";
import { revisitStyles } from "../styles";
import { EmptyState } from "../../common/EmptyState";
import { RevisitCandidateCard } from "./RevisitCandidateCard";
import { useTranslation } from "react-i18next";

type RevisitAroundSnapshotViewProps = {
  snapshot: RevisitAroundSnapshot;
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
  onOpenInActivity: () => void;
};

export function RevisitAroundSnapshotView({
  snapshot,
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
  onOpenInActivity,
}: RevisitAroundSnapshotViewProps) {
  const { t } = useTranslation();
  return (
    <View style={revisitStyles.snapshotList}>
      {/* The header already names the page; the window and its count are one
          quiet line, Activity an ink link (2026-10-16). */}
      <View style={revisitStyles.snapshotMetaRow}>
        <Text style={revisitStyles.snapshotMetaText} numberOfLines={1}>
          {`${snapshot.windowLabel} · ${t("revisit.itemCount", { count: snapshot.items.length })}`}
        </Text>
        <InkLink label={t("revisit.openActivity")} onPress={onOpenInActivity} />
      </View>

      {snapshot.items.length === 0 ? (
        <EmptyState compact icon="calendar-outline" title={t("revisit.nothingSeasonal")} />
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
            onOpen={() => onOpen(candidate)}
            onTogglePlay={() => onTogglePlay(candidate)}
            onStopPlay={onStopPlay}
            onSeekStart={onSeekStart}
            onSeek={onSeek}
            onSeekCancel={onSeekCancel}
            onOpenMenu={() => onOpenMenu(candidate)}
            onViewInCollection={() => onViewInCollection(candidate)}
          />
        ))
      )}
    </View>
  );
}
