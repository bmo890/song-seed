import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { IdeaCard } from "../../common/IdeaCard";
import { MiniProgress } from "../../MiniProgress";
import { StatusBadge } from "../../common/StatusBadge";
import { styles } from "../../../styles";
import type { SongIdea } from "../../../types";
import type { RevisitCandidate } from "../../../revisit";
import { fmtDuration } from "../../../utils";
import { revisitStyles } from "../styles";
import { useStore } from "../../../state/useStore";

function RevisitInlineProgress({
  durationMs,
  onSeek,
  onSeekStart,
  onSeekCancel,
}: {
  durationMs: number;
  onSeek: (ms: number) => void;
  onSeekStart: () => void;
  onSeekCancel: () => void;
}) {
  const inlinePositionMs = useStore((s) => s.inlinePositionMs);
  const inlineDurationMs = useStore((s) => s.inlineDurationMs);

  return (
    <MiniProgress
      currentMs={inlinePositionMs}
      durationMs={inlineDurationMs || durationMs || 0}
      showTopDivider
      extraBottomMargin={2}
      captureWholeLane
      onSeek={onSeek}
      onSeekStart={onSeekStart}
      onSeekCancel={onSeekCancel}
    />
  );
}

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
}: RevisitCandidateCardProps) {
  const durationMs = candidate.primaryClip.durationMs ?? 0;
  const durationLabel = durationMs > 0 ? fmtDuration(durationMs) : "--:--";
  const isProject = candidate.itemKind === "project";
  // Match the collection card: projects show the stage pill with completion %,
  // clips show no badge (getCandidateStatus returns null for them).
  const pct = status ? Math.max(0, Math.min(100, Math.round(candidate.completionPct))) : undefined;

  const trailing = (
    <View style={revisitStyles.cardTrailing}>
      {status ? (
        <StatusBadge status={status} pct={pct} style={styles.ideasListStatusBadgeText} />
      ) : null}
      <Pressable
        style={styles.ideasListFavoriteBtn}
        onPress={(event) => {
          event.stopPropagation();
          onOpenMenu();
        }}
        hitSlop={8}
        accessibilityLabel="More options"
      >
        <Ionicons name="ellipsis-horizontal" size={16} color="#B8A8A3" />
      </Pressable>
    </View>
  );

  return (
    <IdeaCard
      accentBorderColor={isProject ? "#B87D6B" : null}
      canPlay={durationMs > 0}
      isInlinePlaying={isPlaying}
      inlineActive={isActive}
      durationLabel={durationLabel}
      onPressLead={onTogglePlay}
      leadAccessory={
        isActive ? (
          <Pressable
            style={({ pressed }) => [styles.ideasInlineCloseBtn, pressed ? styles.pressDown : null]}
            onPress={(event) => {
              event.stopPropagation();
              onStopPlay();
            }}
          >
            <Ionicons name="stop-circle-outline" size={14} color="#84736f" />
          </Pressable>
        ) : null
      }
      onPress={onOpen}
      onLongPress={onOpenMenu}
      title={candidate.title}
      titleSemiBold={isProject}
      trailing={trailing}
      footerDate={showReason && reason ? reason : undefined}
      inlinePlayerContent={
        <RevisitInlineProgress
          durationMs={durationMs}
          onSeek={onSeek}
          onSeekStart={onSeekStart}
          onSeekCancel={onSeekCancel}
        />
      }
    />
  );
}
