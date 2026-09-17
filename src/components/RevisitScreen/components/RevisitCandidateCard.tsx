import { ViewInCollectionButton } from "../../common/ViewInCollectionButton";
import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { InlineIdeaCard } from "../../common/InlineIdeaCard";
import { styles } from "../../../styles";
import type { SongIdea } from "../../../types";
import type { RevisitCandidate } from "../../../domain/revisit";

type RevisitCandidateCardProps = {
  candidate: RevisitCandidate;
  reason: string;
  showReason?: boolean;
  status: SongIdea["status"] | null;
  isActive: boolean;
  isPlaying: boolean;
  onOpen: () => void;
  onTogglePlay: () => void;
  onStopPlay: () => void;
  onSeekStart: () => void;
  onSeek: (ms: number) => void;
  onSeekCancel: () => void;
  onOpenMenu: () => void;
  onViewInCollection: () => void;
};

export function RevisitCandidateCard({
  candidate,
  reason,
  showReason = true,
  status,
  isActive,
  isPlaying,
  onOpen,
  onTogglePlay,
  onStopPlay,
  onSeekStart,
  onSeek,
  onSeekCancel,
  onOpenMenu,
  onViewInCollection,
}: RevisitCandidateCardProps) {
  const { t } = useTranslation();
  const durationMs = candidate.primaryClip.durationMs ?? 0;

  // Reason on the left, the standardized "view in collection" icon on the right —
  // the same open-outline glyph the queue and Activity use.
  const footerContent = (
    <View style={styles.ideasListMetaRow}>
      {showReason && reason ? (
        <Text style={styles.ideasListCreatedAtText} numberOfLines={1}>
          {reason}
        </Text>
      ) : (
        <View />
      )}
      <ViewInCollectionButton
        testID="revisit-view-in-collection"
        onPress={onViewInCollection}
        accessibilityLabel={t("common.viewInCollection", { title: candidate.title })}
      />
    </View>
  );

  return (
    <InlineIdeaCard
      title={candidate.title}
      isProject={candidate.itemKind === "project"}
      status={status}
      durationMs={durationMs}
      canPlay={durationMs > 0}
      isActive={isActive}
      isPlaying={isPlaying}
      footerContent={footerContent}
      onOpen={onOpen}
      onTogglePlay={onTogglePlay}
      onStopPlay={onStopPlay}
      onSeekStart={onSeekStart}
      onSeek={onSeek}
      onSeekCancel={onSeekCancel}
      onOpenMenu={onOpenMenu}
    />
  );
}
