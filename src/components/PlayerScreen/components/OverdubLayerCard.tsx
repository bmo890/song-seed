import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WaveformMiniPreview } from "../../common/WaveformMiniPreview";
import { StemAlignmentOverlay } from "./StemAlignmentOverlay";
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
 * One overdub layer, progressively disclosed: a compact header (preview, title, on/off)
 * with a one-line summary, and two quiet mode chips — Mix (gain/tone) and Align (overlay,
 * nudges, and the in-place master+layer audition). Only one section is open at a time
 * across all layers (accordion, owned by the sheet). Remove is demoted to a trash icon.
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
  waveformPeaks?: number[];
  gainDb: number;
  offsetMs: number;
  tonePreset: string;
  isMuted: boolean;
  audioUri: string | null;
  // Solo preview of just this layer (existing behavior).
  isPreviewPlaying: boolean;
  previewProgressRatio: number;
  onTogglePreview: () => void;
  onToggleMuted: () => void;
  // Accordion (owned by the sheet so one section is open across all layers).
  expandedSection: OverdubLayerSection | null;
  onToggleSection: (section: OverdubLayerSection) => void;
  // Mix section.
  onAdjustGain: (deltaDb: number) => void;
  onToggleLowCut: () => void;
  onRemove: () => void;
  // Align section.
  masterAudioUri: string | null;
  masterDurationMs: number;
  masterWaveformPeaks?: number[];
  masterRecordingGrid?: RecordingGrid | null;
  onNudge: (deltaMs: number) => void;
  isAuditioning: boolean;
  onToggleAudition: () => void;
};

/** Only say what's non-default; an untouched layer reads just "Overdub". */
function buildSummary(gainDb: number, tonePreset: string, offsetMs: number, isMuted: boolean) {
  const parts: string[] = [];
  if (isMuted) parts.push("Muted");
  if (gainDb !== 0) parts.push(`${gainDb > 0 ? "+" : ""}${gainDb} dB`);
  if (tonePreset === "low-cut") parts.push("Low cut");
  if (offsetMs !== 0) parts.push(formatClipOverdubStemOffsetLabel(offsetMs));
  return parts.length > 0 ? parts.join(" · ") : "Overdub";
}

export function OverdubLayerCard({
  title,
  durationMs,
  waveformPeaks,
  gainDb,
  offsetMs,
  tonePreset,
  isMuted,
  audioUri,
  isPreviewPlaying,
  previewProgressRatio,
  onTogglePreview,
  onToggleMuted,
  expandedSection,
  onToggleSection,
  onAdjustGain,
  onToggleLowCut,
  onRemove,
  masterAudioUri,
  masterDurationMs,
  masterWaveformPeaks,
  masterRecordingGrid,
  onNudge,
  isAuditioning,
  onToggleAudition,
}: Props) {
  const canAudition = !!audioUri && !!masterAudioUri;

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
          <Text style={playerScreenStyles.layerCardMeta} numberOfLines={1}>
            {buildSummary(gainDb, tonePreset, offsetMs, isMuted)}
          </Text>
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
      </View>

      {/* The plain strip doubles as the solo-preview progress view; the Align section
          replaces it with the superimposed master+layer view, so hide it there. */}
      {expandedSection !== "align" ? (
        <View style={playerScreenStyles.layerWaveWrap}>
          <WaveformMiniPreview peaks={waveformPeaks} bars={72} />
          <View
            pointerEvents="none"
            style={[
              playerScreenStyles.layerWavePlayhead,
              { left: `${Math.max(0, Math.min(100, previewProgressRatio * 100))}%` },
            ]}
          />
        </View>
      ) : null}

      <View style={cardStyles.modeRow}>
        <Pressable
          style={[cardStyles.modeChip, expandedSection === "mix" ? cardStyles.modeChipActive : null]}
          onPress={() => onToggleSection("mix")}
        >
          <Ionicons
            name="options-outline"
            size={13}
            color={expandedSection === "mix" ? "#ffffff" : "#5a4b45"}
          />
          <Text
            style={[
              cardStyles.modeChipText,
              expandedSection === "mix" ? cardStyles.modeChipTextActive : null,
            ]}
          >
            Mix
          </Text>
        </Pressable>
        <Pressable
          style={[
            cardStyles.modeChip,
            expandedSection === "align" ? cardStyles.modeChipActive : null,
          ]}
          onPress={() => onToggleSection("align")}
        >
          <Ionicons
            name="git-compare-outline"
            size={13}
            color={expandedSection === "align" ? "#ffffff" : "#5a4b45"}
          />
          <Text
            style={[
              cardStyles.modeChipText,
              expandedSection === "align" ? cardStyles.modeChipTextActive : null,
            ]}
          >
            Align
          </Text>
        </Pressable>
        <View style={cardStyles.modeSpacer} />
        <Pressable
          style={cardStyles.trashButton}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel="Remove this layer"
        >
          <Ionicons name="trash-outline" size={15} color="#a3564a" />
        </Pressable>
      </View>

      {expandedSection === "mix" ? (
        <View style={cardStyles.section}>
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
          </View>
          <Text style={cardStyles.alignHint}>
            ◀ pulls this layer earlier · nudge while playing to hear it move
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "#efeae4",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modeChipActive: {
    backgroundColor: "#824f3f",
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5a4b45",
  },
  modeChipTextActive: {
    color: "#ffffff",
  },
  modeSpacer: {
    flex: 1,
  },
  trashButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginTop: 10,
    gap: 10,
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
  alignHint: {
    fontSize: 11,
    color: "#84736f",
  },
});
