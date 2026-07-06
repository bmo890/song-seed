import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { StemAlignmentOverlay } from "./StemAlignmentOverlay";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import { WarmModal } from "../../common/WarmModal";
import { HueSlider } from "../../common/HueSlider";
import { playerScreenStyles } from "../styles";
import { fmtDuration } from "../../../utils";
import { colors } from "../../../design/tokens";
import { computeWorkspaceTheme, hexToHue, hueToAccentHex } from "../../../workspaceTheme";
import {
  formatClipOverdubStemOffsetLabel,
  OVERDUB_GAIN_STEP_DB,
  OVERDUB_STEM_NUDGE_STEP_LARGE_MS,
  OVERDUB_STEM_NUDGE_STEP_SMALL_MS,
} from "../../../overdub";
import type { RecordingGrid } from "../../../types";

/**
 * One layer: a quiet resting row (solo-play · title/summary · mute · ⋯) with Levels and
 * Timing as mode chips underneath — tap to disclose, tap again to collapse, one open at a
 * time across the sheet (accordion). The ⋯ menu holds only the two one-shot actions: Edit
 * (name + color together) and Remove.
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
  /** This layer's color key — tints the card background and (in Align) its waveform, so
   *  a stack of layers reads as distinct at a glance. Adjustable via the ⋯ Edit action. */
  color: string;
  onChangeColor: (color: string) => void;
  /** A background mix render is in flight for this clip — shown as a quiet spinner next
   *  to this layer's title while its section is open (the layer the user is acting on). */
  isRendering?: boolean;
  // Solo preview of just this layer.
  isPreviewPlaying: boolean;
  /** This layer is the loaded preview (playing OR paused mid-way) — keeps the scrub bar
   *  up so pause → scrub → resume works like the main transport. */
  isPreviewActive: boolean;
  previewProgressRatio: number;
  onSeekPreview: (ratio: number) => void;
  onTogglePreview: () => void;
  onToggleMuted: () => void;
  // Accordion (owned by the sheet so one section is open across all layers).
  expandedSection: OverdubLayerSection | null;
  onToggleSection: (section: OverdubLayerSection) => void;
  // Row actions (all behind the ⋯ menu except the mute toggle above).
  onRename: (title: string) => void;
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
  color,
  onChangeColor,
  isRendering = false,
  isPreviewPlaying,
  isPreviewActive,
  previewProgressRatio,
  onSeekPreview,
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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const cardTint = computeWorkspaceTheme(color).tint;
  const showSpinner = isRendering && expandedSection != null;

  function openLayerMenu() {
    AppAlert.custom(title, undefined, [
      { label: "Edit", icon: actionIcons.edit, onPress: () => setEditModalOpen(true) },
      { label: "Remove", style: "destructive", icon: actionIcons.delete, onPress: onRemove },
      { label: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View style={[playerScreenStyles.layerCard, { backgroundColor: cardTint }]}>
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
            {showSpinner ? (
              <ActivityIndicator size="small" color="#824f3f" accessibilityLabel="Updating layer mix" />
            ) : null}
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

      {/* Scrubbable preview transport while this layer is loaded (playing or paused) —
          drag to jump around the layer instead of listening end-to-end. */}
      {isPreviewActive ? (
        <Slider
          style={cardStyles.soloScrubber}
          minimumValue={0}
          maximumValue={1}
          value={Math.max(0, Math.min(1, previewProgressRatio))}
          onSlidingComplete={onSeekPreview}
          minimumTrackTintColor="#824f3f"
          maximumTrackTintColor="#e3d8cd"
          thumbTintColor="#824f3f"
          accessibilityLabel="Scrub this layer's preview"
        />
      ) : null}

      <View style={cardStyles.modeRow}>
        <Pressable
          style={[cardStyles.modeChip, expandedSection === "mix" ? cardStyles.modeChipActive : null]}
          onPress={() => onToggleSection("mix")}
          accessibilityRole="button"
          accessibilityState={{ expanded: expandedSection === "mix" }}
        >
          <Ionicons
            name="options-outline"
            size={13}
            color={expandedSection === "mix" ? "#ffffff" : "#5a4b45"}
          />
          <Text style={[cardStyles.modeChipText, expandedSection === "mix" ? cardStyles.modeChipTextActive : null]}>
            Levels
          </Text>
        </Pressable>
        <Pressable
          style={[cardStyles.modeChip, expandedSection === "align" ? cardStyles.modeChipActive : null]}
          onPress={() => onToggleSection("align")}
          accessibilityRole="button"
          accessibilityState={{ expanded: expandedSection === "align" }}
        >
          <Ionicons
            name="git-compare-outline"
            size={13}
            color={expandedSection === "align" ? "#ffffff" : "#5a4b45"}
          />
          <Text
            style={[cardStyles.modeChipText, expandedSection === "align" ? cardStyles.modeChipTextActive : null]}
          >
            Timing
          </Text>
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
            stemColor={color}
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

      <EditLayerModal
        visible={editModalOpen}
        title={title}
        color={color}
        onSave={(nextTitle, nextColor) => {
          if (nextTitle.trim() && nextTitle.trim() !== title) {
            onRename(nextTitle.trim());
          }
          if (nextColor !== color) {
            onChangeColor(nextColor);
          }
        }}
        onClose={() => setEditModalOpen(false)}
      />
    </View>
  );
}

/** Name + color editor for a layer, combined into one Edit action — the same HueSlider
 *  used for workspace/section colors, so picking a layer's color matches the rest of the
 *  app. Draft state resets from props each time the modal opens. */
function EditLayerModal({
  visible,
  title,
  color,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  color: string;
  onSave: (title: string, color: string) => void;
  onClose: () => void;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [hue, setHue] = useState(() => hexToHue(color));
  const prevVisible = React.useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setDraftTitle(title);
      setHue(hexToHue(color));
    }
    prevVisible.current = visible;
  }, [visible, title, color]);

  const previewColor = hueToAccentHex(hue);
  const trimmed = draftTitle.trim();

  return (
    <WarmModal visible={visible} onRequestClose={onClose} title="Edit layer">
      <View style={cardStyles.colorPreviewRow}>
        <View style={[cardStyles.colorPreviewSwatch, { backgroundColor: previewColor }]} />
        <TextInput
          style={cardStyles.editNameInput}
          value={draftTitle}
          onChangeText={setDraftTitle}
          placeholder="Layer name"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
        />
      </View>
      <HueSlider hue={hue} onChange={setHue} />
      <View style={cardStyles.colorModalActions}>
        <Pressable style={cardStyles.colorModalCancel} onPress={onClose} accessibilityRole="button">
          <Text style={cardStyles.colorModalCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[cardStyles.colorModalConfirm, !trimmed ? cardStyles.colorModalConfirmDisabled : null]}
          onPress={() => {
            if (!trimmed) return;
            onSave(trimmed, previewColor);
            onClose();
          }}
          disabled={!trimmed}
          accessibilityRole="button"
        >
          <Text style={cardStyles.colorModalConfirmText}>Save</Text>
        </Pressable>
      </View>
    </WarmModal>
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
  soloScrubber: {
    width: "100%",
    height: 26,
    marginTop: -2,
  },
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
  colorPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  colorPreviewSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  editNameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#1b1c1a",
    paddingVertical: 6,
  },
  colorModalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  colorModalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  colorModalCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5a4b45",
  },
  colorModalConfirm: {
    borderRadius: 999,
    backgroundColor: "#824f3f",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  colorModalConfirmDisabled: {
    opacity: 0.5,
  },
  colorModalConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
});
