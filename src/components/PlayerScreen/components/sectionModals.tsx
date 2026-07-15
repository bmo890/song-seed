import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { fmtDuration } from "../../../utils";
import { colors } from "../../../design/tokens";
import {
  getSectionColor,
  getSectionPreset,
  MIN_SECTION_LENGTH_MS,
  SECTION_QUICK_ADD,
} from "../../../domain/playerSections";
import type { SectionCustomInput } from "../hooks/usePlayerSections";
import { WarmModal } from "../../common/WarmModal";
import { HueSlider } from "../../common/HueSlider";
import { hexToHue, hueToAccentHex } from "../../../domain/workspaceTheme";
import { playerScreenStyles as s } from "../styles";
import type { ClipSection, ClipSectionKind } from "../../../types";
import { haptic } from "../../../design/haptics";
import { PLAYHEAD_COLOR, PlayheadCursorIcon } from "./practicePanelPrimitives";

/** Single adjuster for whichever edge (start/end) is active, with a pin-to-playhead button. */
export function SectionEdgeAdjuster({
  section,
  edge,
  durationMs,
  playheadMs,
  onReposition,
  onPreview,
}: {
  section: ClipSection;
  edge: "start" | "end";
  durationMs: number;
  playheadMs: number;
  onReposition: (sectionId: string, edge: "start" | "end", ms: number) => void;
  onPreview: (preview: { id: string; startMs?: number; endMs?: number } | null) => void;
}) {
  const [dragMs, setDragMs] = useState<number | null>(null);
  const isStart = edge === "start";
  const current = isStart ? section.startMs : section.endMs;
  // Keep the handle on its own side of the section; the resolver pushes neighbours on commit.
  const minMs = isStart ? 0 : Math.min(section.startMs + MIN_SECTION_LENGTH_MS, Math.max(1, durationMs));
  const maxMs = isStart
    ? Math.max(0, section.endMs - MIN_SECTION_LENGTH_MS)
    : Math.max(1, durationMs);
  const clamp = (ms: number) => Math.max(minMs, Math.min(maxMs, ms));
  const stepBy = (deltaMs: number) => onReposition(section.id, edge, clamp(current + deltaMs));
  // Pinning the active edge to the playhead only makes sense when it stays on its own side of
  // the section (start before end, end after start). Crossing neighbours is fine — the resolver
  // pushes them — so only the self-crossing case is disabled.
  const canPin = isStart
    ? playheadMs <= section.endMs - MIN_SECTION_LENGTH_MS
    : playheadMs >= section.startMs + MIN_SECTION_LENGTH_MS;
  const displayMs = dragMs ?? current;
  return (
    <View style={s.sectionAdjuster}>
      <View style={s.sectionAdjusterHeader}>
        <Text style={s.sectionEdgeLabel}>{isStart ? "Start" : "End"}</Text>
        <Text style={s.sectionEdgeLiveTime}>{fmtDuration(displayMs)}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          style={[s.sectionPinCircle, !canPin ? s.sectionPinCircleDisabled : null]}
          onPress={() => canPin && onReposition(section.id, edge, Math.round(playheadMs))}
          disabled={!canPin}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Set ${edge} to playhead (${fmtDuration(playheadMs)})`}
        >
          <PlayheadCursorIcon color={canPin ? PLAYHEAD_COLOR : colors.textMuted} />
        </Pressable>
      </View>
      <View style={s.pinTrayRow}>
        <Pressable
          style={s.pinStepButton}
          onPress={() => stepBy(-1000)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Nudge ${edge} back one second`}
        >
          <Ionicons name="chevron-back" size={16} color={colors.textStrong} />
        </Pressable>
        <Slider
          style={s.pinSlider}
          minimumValue={minMs}
          maximumValue={maxMs}
          step={50}
          value={Math.max(minMs, Math.min(maxMs, current))}
          onValueChange={(value) => {
            const next = Math.round(value);
            setDragMs(next);
            onPreview({ id: section.id, [isStart ? "startMs" : "endMs"]: next });
          }}
          onSlidingComplete={(value) => {
            haptic.tap();
            onReposition(section.id, edge, Math.round(value));
            onPreview(null);
            setDragMs(null);
          }}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.surfaceHigh}
          thumbTintColor={colors.primary}
        />
        <Pressable
          style={s.pinStepButton}
          onPress={() => stepBy(1000)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Nudge ${edge} forward one second`}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.textStrong} />
        </Pressable>
      </View>
    </View>
  );
}

export function SectionPickerModal({
  visible,
  title,
  customOptions,
  onPickPreset,
  onPickCustom,
  onCreateNew,
  onClose,
}: {
  visible: boolean;
  title: string;
  customOptions: { label: string; color: string }[];
  onPickPreset: (kind: ClipSectionKind) => void;
  onPickCustom: (custom: SectionCustomInput) => void;
  onCreateNew: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.sectionModalBackdrop} onPress={onClose}>
        <Pressable style={s.sectionModalCard} onPress={() => {}}>
          <Text style={s.sectionModalTitle}>{title}</Text>
          <View style={s.sectionModalGrid}>
            {SECTION_QUICK_ADD.map((kind) => {
              const preset = getSectionPreset(kind);
              return (
                <Pressable
                  key={kind}
                  style={s.sectionChip}
                  onPress={() => onPickPreset(kind)}
                  accessibilityRole="button"
                  accessibilityLabel={preset.label}
                >
                  <View style={[s.sectionSwatch, { backgroundColor: preset.color }]} />
                  <Text style={s.sectionChipText}>{preset.label}</Text>
                </Pressable>
              );
            })}
            {customOptions.map((option) => (
              <Pressable
                key={`custom-${option.label}`}
                style={s.sectionChip}
                onPress={() => onPickCustom(option)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                <View style={[s.sectionSwatch, { backgroundColor: option.color }]} />
                <Text style={s.sectionChipText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.sectionPickerFooter}>
            <Pressable
              style={s.sectionModalNewButton}
              onPress={onCreateNew}
              accessibilityRole="button"
              accessibilityLabel="Create a new custom section type"
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={s.sectionModalNewText}>New custom…</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable style={s.sectionModalCancel} onPress={onClose} accessibilityRole="button">
              <Text style={s.sectionModalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Title + colour editor used both for "new custom section" and editing an existing one.
 *  Reuses the workspace HueSlider so the colour control matches the rest of the app. */
export function SectionDetailModal({
  visible,
  title,
  confirmLabel,
  initialName,
  initialColor,
  onConfirm,
  onDelete,
  onClose,
}: {
  visible: boolean;
  title: string;
  confirmLabel: string;
  initialName: string;
  initialColor: string;
  onConfirm: (custom: SectionCustomInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [hue, setHue] = useState(() => hexToHue(initialColor));
  const prevVisible = React.useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setName(initialName);
      setHue(hexToHue(initialColor));
    }
    prevVisible.current = visible;
  }, [visible, initialName, initialColor]);

  const accentColor = hueToAccentHex(hue);
  const trimmed = name.trim();
  return (
    <WarmModal visible={visible} onRequestClose={onClose} title={title}>
      <View style={s.sectionDetailPreviewRow}>
        <View style={[s.sectionDetailSwatch, { backgroundColor: accentColor }]} />
        <Text style={s.sectionDetailPreviewText} numberOfLines={1}>
          {trimmed || "Section name"}
        </Text>
      </View>
      <HueSlider hue={hue} onChange={setHue} />
      <TextInput
        style={s.sectionEditInput}
        value={name}
        onChangeText={setName}
        placeholder="Section name"
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        onSubmitEditing={() => trimmed && onConfirm({ label: trimmed, color: accentColor })}
      />
      <View style={s.sectionModalActions}>
        {onDelete ? (
          <Pressable
            style={s.sectionModalDelete}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete section"
          >
            <Ionicons name="trash-outline" size={17} color={colors.danger} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable style={s.sectionModalCancel} onPress={onClose} accessibilityRole="button">
          <Text style={s.sectionModalCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[s.sectionModalConfirm, !trimmed ? s.sectionModalConfirmDisabled : null]}
          onPress={() => trimmed && onConfirm({ label: trimmed, color: accentColor })}
          disabled={!trimmed}
          accessibilityRole="button"
        >
          <Text style={s.sectionModalConfirmText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </WarmModal>
  );
}

/** Quick picker to drop the loop region onto an existing section. */
export function LoopSectionPickerModal({
  visible,
  sections,
  onPick,
  onClose,
}: {
  visible: boolean;
  sections: ClipSection[];
  onPick: (section: ClipSection) => void;
  onClose: () => void;
}) {
  return (
    <WarmModal visible={visible} onRequestClose={onClose} title="Loop a section" scrollable>
      {sections.map((section) => (
        <Pressable
          key={section.id}
          style={s.loopSectionRow}
          onPress={() => onPick(section)}
          accessibilityRole="button"
          accessibilityLabel={`Loop ${section.label}`}
        >
          <View style={[s.sectionSwatch, { backgroundColor: getSectionColor(section) }]} />
          <Text style={s.loopSectionLabel} numberOfLines={1}>
            {section.label}
          </Text>
          <Text style={s.loopSectionTime}>
            {fmtDuration(section.startMs)}–{fmtDuration(section.endMs)}
          </Text>
        </Pressable>
      ))}
      <View style={s.sectionModalActions}>
        <View style={{ flex: 1 }} />
        <Pressable style={s.sectionModalCancel} onPress={onClose} accessibilityRole="button">
          <Text style={s.sectionModalCancelText}>Cancel</Text>
        </Pressable>
      </View>
    </WarmModal>
  );
}
