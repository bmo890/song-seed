import React from "react";
import { InlineIdeaCard } from "../../common/InlineIdeaCard";
import type { SongIdea } from "../../../types";
import type { RevisitCandidate } from "../../../revisit";

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
      footer={showReason && reason ? reason : undefined}
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
