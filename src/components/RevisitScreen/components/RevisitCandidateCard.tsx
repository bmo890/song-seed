import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { InlineIdeaCard } from "../../common/InlineIdeaCard";
import { styles } from "../../../styles";
import { colors } from "../../../design/tokens";
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
      <Pressable
        style={({ pressed }) => [{ alignItems: "center", justifyContent: "center" }, pressed ? { opacity: 0.6 } : null]}
        onPress={(event) => {
          event.stopPropagation();
          onViewInCollection();
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`View ${candidate.title} in collection`}
      >
        <Ionicons name="open-outline" size={15} color={colors.textMuted} />
      </Pressable>
    </View>
  );

  return (
    <InlineIdeaCard
      title={candidate.title}
      isProject={candidate.itemKind === "project"}
      status={status}
      completionPct={candidate.completionPct}
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
