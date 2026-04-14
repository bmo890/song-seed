import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SurfaceCard } from "../../common/SurfaceCard";
import { MiniProgress } from "../../MiniProgress";
import { StatusBadge } from "../../common/StatusBadge";
import type { SongIdea } from "../../../types";
import type { RevisitCandidate } from "../../../revisit";
import { fmtDuration } from "../../../utils";
import { revisitStyles } from "../styles";

type RevisitCandidateCardProps = {
  candidate: RevisitCandidate;
  reason: string;
  showReason?: boolean;
  status: SongIdea["status"] | null;
  isActive: boolean;
  isPlaying: boolean;
  inlinePositionMs: number;
  inlineDurationMs: number;
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
  inlinePositionMs,
  inlineDurationMs,
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

  return (
    <View style={revisitStyles.candidateWrap}>
      <SurfaceCard style={revisitStyles.candidateCard} onPress={onOpen}>
        {showReason ? <Text style={revisitStyles.reasonText}>{reason}</Text> : null}

        <View style={revisitStyles.candidateTopRow}>
          <View style={revisitStyles.candidateLeadCol}>
            <Pressable
              style={({ pressed }) => [revisitStyles.candidatePlayBtn, pressed ? { opacity: 0.78 } : null]}
              onPress={(event) => {
                event.stopPropagation();
                onTogglePlay();
              }}
            >
              <Ionicons
                name={isActive && isPlaying ? "pause" : "play"}
                size={18}
                color="#1b1c1a"
                style={!isActive || !isPlaying ? { marginLeft: 2 } : undefined}
              />
            </Pressable>
            {isActive ? (
              <Pressable
                style={({ pressed }) => [revisitStyles.candidateStopBtn, pressed ? { opacity: 0.78 } : null]}
                onPress={(event) => {
                  event.stopPropagation();
                  onStopPlay();
                }}
              >
                <Ionicons name="stop" size={14} color="#84736f" />
              </Pressable>
            ) : null}
          </View>

          <View style={revisitStyles.candidateMain}>
            <View style={revisitStyles.candidateTitleRow}>
              <View style={revisitStyles.candidateTitleBlock}>
                <Text style={revisitStyles.candidateTitle} numberOfLines={1}>
                  {candidate.title}
                </Text>
                <Text style={revisitStyles.candidateContext} numberOfLines={1}>
                  {candidate.workspaceTitle} • {candidate.collectionPathLabel}
                </Text>
              </View>
              <View style={revisitStyles.candidateTopActions}>
                <View style={revisitStyles.candidateKindPill}>
                  <Text style={revisitStyles.candidateKindPillText}>
                    {candidate.itemKind === "project" ? "Song" : "Clip"}
                  </Text>
                </View>
                {status ? <StatusBadge status={status} /> : null}
                <Pressable
                  style={({ pressed }) => [revisitStyles.candidateMenuBtn, pressed ? { opacity: 0.78 } : null]}
                  onPress={(event) => {
                    event.stopPropagation();
                    onOpenMenu();
                  }}
                >
                  <Ionicons name="ellipsis-horizontal" size={16} color="#84736f" />
                </Pressable>
              </View>
            </View>

            {isActive ? (
              <View style={revisitStyles.candidateProgressWrap}>
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
              </View>
            ) : (
              <Text style={revisitStyles.candidateDurationLabel}>{durationLabel}</Text>
            )}
          </View>
        </View>
      </SurfaceCard>
    </View>
  );
}
