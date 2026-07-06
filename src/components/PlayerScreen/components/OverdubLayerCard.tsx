import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StemAlignmentOverlay } from "./StemAlignmentOverlay";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import { playerScreenStyles } from "../styles";
import { fmtDuration } from "../../../utils";
import {
  formatClipOverdubStemOffsetLabel,
  OVERDUB_GAIN_STEP_DB,
  OVERDUB_STEM_NUDGE_STEP_LARGE_MS,
  OVERDUB_STEM_NUDGE_STEP_SMALL_MS,
} from "../../../overdub";
import type { RecordingGrid } from "../../../types";

/**
 * One layer, at rest a single quiet row: solo-play · title/summary · mute · ⋯. Levels and
 * Align are workspaces, not always-on controls — the ⋯ menu (Rename / Adjust / Align /
 * Remove) discloses one at a time so a stack of layers stays scannable. The resting
 * waveform is gone: it carried no information without the master under it (that context
 * only exists in Align's superimposed overlay); a slim progress lane stands in while a
 * layer solo-plays.
 */

export type OverdubLayerSection = "mix" | "align";

export const LayerControlButton = React.memo(function LayerControlButton({
  label,
  onPress,
  active = false,
  destructive = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        playerScreenStyles.layerControlButton,
        active ? playerScreenStyles.layerControlButtonActive : null,
        destructive ? playerScreenStyles.layerControlButtonDestructive : null,
        disabled ? playerScreenStyles.layerControlButtonDisabled : null,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          playerScreenStyles.layerControlButtonText,
          active ? playerScreenStyles.layerControlButtonTextActive : null,
          destructive ? playerScreenStyles.layerControlButtonTextDestructive : null,
          disabled ? playerScreenStyles.layerControlButtonTextDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

type Props = {
  title: string;
  durationMs: number;
  gainDb: number;
  offsetMs: number;
  tonePreset: string;
  isMuted: boolean;
  audioUri: string | null;
  waveformPeaks?: number[];
  // Solo preview of just this layer.
  isPreviewPlaying: boolean;
  previewProgressRatio: number;
  onTogglePreview: () => void;
  onToggleMuted: () => void;
  // Accordion (owned by the sheet so one section is open across all layers).
  expandedSection: OverdubLayerSection | null;
  onToggleSection: (section: OverdubLayerSection) => void;
  // Row actions (all behind the ⋯ menu except the mute toggle above).
  onRename: () => void;
  onRemove: () => void;
  // Mix section.
  onAdjustGain: (deltaDb: number) => void;
  onToggleLowCut: () => void;
  // Align section.
  masterAudioUri: string | null;
  masterDurationMs: number;
  masterWaveformPeaks?: number[];
  masterRecordingGrid?: RecordingGrid | null;
  onNudge: (deltaMs: number) => void;
  /** The offset this layer had when the Align section was opened — "Original" reverts to
   *  it, undoing this sitting's nudges without touching a previously-saved alignment. */
  baselineOffsetMs: number;
  onRestoreOriginal: () => void;
  isAuditioning: boolean;
  onToggleAudition: () => void;
};

/** Only say what's non-default; an untouched layer shows just its title. */
function buildSummary(gainDb: number, tonePreset: string, offsetMs: number, isMuted: boolean) {
  const parts: string[] = [];
  if (isMuted) parts.push("Muted");
  if (gainDb !== 0) parts.push(`${gainDb > 0 ? "+" : ""}${gainDb} dB`);
  if (tonePreset === "low-cut") parts.push("Low cut");
  if (offsetMs !== 0) parts.push(formatClipOverdubStemOffsetLabel(offsetMs));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function OverdubLayerCard({
  title,
  durationMs,
  gainDb,
  offsetMs,
  tonePreset,
  isMuted,
  audioUri,
  waveformPeaks,
  isPreviewPlaying,
  previewProgressRatio,
  onTogglePreview,
  onToggleMuted,
  expandedSection,
  onToggleSection,
  onRename,
  onRemove,
  onAdjustGain,
  onToggleLowCut,
  masterAudioUri,
  masterDurationMs,
  masterWaveformPeaks,
  masterRecordingGrid,
  onNudge,
  baselineOffsetMs,
  onRestoreOriginal,
  isAuditioning,
  onToggleAudition,
}: Props) {
  const canAudition = !!audioUri && !!masterAudioUri;
  const canRestoreOriginal = offsetMs !== baselineOffsetMs;
  const summary = buildSummary(gainDb, tonePreset, offsetMs, isMuted);

  function openLayerMenu() {
    AppAlert.custom(title, undefined, [
      { label: "Rename layer", icon: actionIcons.rename, onPress: onRename },
      {
        label: expandedSection === "mix" ? "Hide levels" : "Adjust levels",
        icon: "options-outline",
        onPress: () => onToggleSection("mix"),
      },
      {
        label: expandedSection === "align" ? "Hide alignment" : "Align timing",
        icon: "git-compare-outline",
        onPress: () => onToggleSection("align"),
      },
      { label: "Remove layer", style: "destructive", icon: actionIcons.delete, onPress: onRemove },
      { label: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View style={playerScreenStyles.layerCard}>
      <View style={playerScreenStyles.layerCardHeader}>
        <Pressable style={playerScreenStyles.layerPlayButton} onPress={onTogglePreview}>
          <Ionicons
            name={isPreviewPlaying ? "pause" : "play"}
            size={16}
            color="#824f3f"
            style={isPreviewPlaying ? undefined : playerScreenStyles.layerPlayButtonIcon}
          />
        </Pressable>
        <View style={playerScreenStyles.layerCardCopy}>
          <View style={playerScreenStyles.layerCardTitleRow}>
            <Text style={playerScreenStyles.layerCardTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={playerScreenStyles.layerCardDuration}>{fmtDuration(durationMs)}</Text>
          </View>
          {summary ? (
            <Text style={playerScreenStyles.layerCardMeta} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Pressable
          style={[
            playerScreenStyles.layerEnabledDot,
            !isMuted ? playerScreenStyles.layerEnabledDotActive : null,
          ]}
          onPress={onToggleMuted}
          accessibilityRole="switch"
          accessibilityState={{ checked: !isMuted }}
          accessibilityLabel={isMuted ? "Unmute this layer" : "Mute this layer"}
        />
        <Pressable
          style={cardStyles.menuButton}
          onPress={openLayerMenu}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Layer options"
        >
          <Ionicons name="ellipsis-horizontal" size={18} color="#84736f" />
        </Pressable>
      </View>

      {/* Slim progress lane while this layer solo-plays — the only time a bare waveform
          would have meant anything. */}
      {isPreviewPlaying ? (
        <View style={cardStyles.soloProgressTrack}>
          <View
            style={[
              cardStyles.soloProgressFill,
              { width: `${Math.max(0, Math.min(100, previewProgressRatio * 100))}%` },
            ]}
          />
        </View>
      ) : null}

      {expandedSection === "mix" ? (
        <View style={cardStyles.section}>
          <PanelHeader label="Levels" onCollapse={() => onToggleSection("mix")} />
          <View style={playerScreenStyles.layerControls}>
            <LayerControlButton
              label={`-${OVERDUB_GAIN_STEP_DB} dB`}
              onPress={() => onAdjustGain(-OVERDUB_GAIN_STEP_DB)}
            />
            <View style={cardStyles.gainReadout}>
              <Text style={cardStyles.gainReadoutText}>
                {`${gainDb > 0 ? "+" : ""}${gainDb} dB`}
              </Text>
            </View>
            <LayerControlButton
              label={`+${OVERDUB_GAIN_STEP_DB} dB`}
              onPress={() => onAdjustGain(OVERDUB_GAIN_STEP_DB)}
            />
            <LayerControlButton
              label="Low cut"
              active={tonePreset === "low-cut"}
              onPress={onToggleLowCut}
            />
          </View>
        </View>
      ) : null}

      {expandedSection === "align" ? (
        <View style={cardStyles.section}>
          <PanelHeader label="Align" onCollapse={() => onToggleSection("align")} />
          <StemAlignmentOverlay
            masterAudioUri={masterAudioUri}
            masterDurationMs={masterDurationMs}
            masterFallbackPeaks={masterWaveformPeaks}
            stemAudioUri={audioUri}
            stemDurationMs={durationMs}
            stemFallbackPeaks={waveformPeaks}
            offsetMs={offsetMs}
            recordingGrid={masterRecordingGrid}
          />
          <View style={cardStyles.alignControls}>
            <Pressable
              style={[
                cardStyles.auditionButton,
                isAuditioning ? cardStyles.auditionButtonActive : null,
                !canAudition ? cardStyles.auditionButtonDisabled : null,
              ]}
              onPress={onToggleAudition}
              disabled={!canAudition}
              accessibilityRole="button"
              accessibilityLabel={
                isAuditioning ? "Stop playing together" : "Play master and this layer together"
              }
            >
              <Ionicons
                name={isAuditioning ? "stop" : "play"}
                size={14}
                color={isAuditioning ? "#ffffff" : "#824f3f"}
              />
              <Text
                style={[
                  cardStyles.auditionButtonText,
                  isAuditioning ? cardStyles.auditionButtonTextActive : null,
                ]}
              >
                {isAuditioning ? "Stop" : "Play together"}
              </Text>
            </Pressable>
            <View style={cardStyles.nudgeCluster}>
              <LayerControlButton
                label={`◀ ${OVERDUB_STEM_NUDGE_STEP_LARGE_MS}`}
                onPress={() => onNudge(-OVERDUB_STEM_NUDGE_STEP_LARGE_MS)}
              />
              <LayerControlButton
                label={`◀ ${OVERDUB_STEM_NUDGE_STEP_SMALL_MS}`}
                onPress={() => onNudge(-OVERDUB_STEM_NUDGE_STEP_SMALL_MS)}
              />
              <LayerControlButton
                label={`${OVERDUB_STEM_NUDGE_STEP_SMALL_MS} ▶`}
                onPress={() => onNudge(OVERDUB_STEM_NUDGE_STEP_SMALL_MS)}
              />
              <LayerControlButton
                label={`${OVERDUB_STEM_NUDGE_STEP_LARGE_MS} ▶`}
                onPress={() => onNudge(OVERDUB_STEM_NUDGE_STEP_LARGE_MS)}
              />
            </View>
            <Pressable
              style={[
                cardStyles.originalButton,
                !canRestoreOriginal ? cardStyles.originalButtonDisabled : null,
              ]}
              onPress={onRestoreOriginal}
              disabled={!canRestoreOriginal}
              accessibilityRole="button"
              accessibilityLabel="Restore the original alignment"
            >
              <Ionicons name="refresh-outline" size={13} color="#5a4b45" />
              <Text style={cardStyles.originalButtonText}>Original</Text>
            </Pressable>
          </View>
          <Text style={cardStyles.alignHint}>
            ◀ pulls this layer earlier · nudge while playing to hear it move
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function PanelHeader({ label, onCollapse }: { label: string; onCollapse: () => void }) {
  return (
    <View style={cardStyles.panelHeader}>
      <Text style={cardStyles.panelTitle}>{label}</Text>
      <Pressable
        style={cardStyles.panelCollapse}
        onPress={onCollapse}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Close ${label}`}
      >
        <Ionicons name="chevron-up" size={14} color="#a89994" />
      </Pressable>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  menuButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  soloProgressTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: "#ece3da",
    overflow: "hidden",
  },
  soloProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#824f3f",
  },
  section: {
    marginTop: 10,
    gap: 10,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6a5751",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  panelCollapse: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  gainReadout: {
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  gainReadoutText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1b1c1a",
  },
  alignControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  auditionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8c6bd",
    backgroundColor: "#faf6f1",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  auditionButtonActive: {
    backgroundColor: "#824f3f",
    borderColor: "#824f3f",
  },
  auditionButtonDisabled: {
    opacity: 0.45,
  },
  auditionButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#824f3f",
  },
  auditionButtonTextActive: {
    color: "#ffffff",
  },
  nudgeCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  originalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "#efeae4",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  originalButtonDisabled: {
    opacity: 0.45,
  },
  originalButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5a4b45",
  },
  alignHint: {
    fontSize: 11,
    color: "#84736f",
  },
});
