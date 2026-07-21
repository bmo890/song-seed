import React, { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { fmtDuration } from "../../../utils";
import { colors } from "../../../design/tokens";
import { WarmModal } from "../../common/WarmModal";
import { playerScreenStyles as s } from "../styles";
import type { PracticeMarker } from "../../../types";
import { haptic } from "../../../design/haptics";
import { PLAYHEAD_COLOR, PlayheadCursorIcon } from "./practicePanelPrimitives";
import { useTranslation } from "react-i18next";
import { UserTextInput } from "../../../i18n";

/** Single-point timing adjuster for a pin — mirrors SectionEdgeAdjuster. */
export function PinTimingAdjuster({
  marker,
  durationMs,
  playheadMs,
  onReposition,
  onPreview,
}: {
  marker: PracticeMarker;
  durationMs: number;
  playheadMs: number;
  onReposition: (markerId: string, atMs: number) => void;
  onPreview: (preview: { id: string; atMs: number } | null) => void;
}) {
  const { t } = useTranslation();
  const [dragMs, setDragMs] = useState<number | null>(null);
  const current = marker.atMs;
  const maxMs = Math.max(1, durationMs);
  const displayMs = dragMs ?? current;
  const clamp = (ms: number) => Math.max(0, Math.min(maxMs, ms));
  const stepBy = (deltaMs: number) => onReposition(marker.id, clamp(current + deltaMs));
  return (
    <View style={s.sectionAdjuster}>
      <View style={s.sectionAdjusterHeader}>
        <Text style={s.sectionEdgeLabel}>{t("player.time")}</Text>
        <Text style={s.sectionEdgeLiveTime}>{fmtDuration(displayMs)}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          style={s.sectionPinCircle}
          onPress={() => onReposition(marker.id, Math.round(clamp(playheadMs)))}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.setPinPlayhead", { time: fmtDuration(playheadMs) })}
        >
          <PlayheadCursorIcon color={PLAYHEAD_COLOR} />
        </Pressable>
      </View>
      <View style={s.pinTrayRow}>
        <Pressable
          style={s.pinStepButton}
          onPress={() => stepBy(-1000)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.nudgePinBack")}
        >
          <Ionicons name="chevron-back" size={16} color={colors.textStrong} />
        </Pressable>
        <Slider
          style={s.pinSlider}
          minimumValue={0}
          maximumValue={maxMs}
          step={50}
          value={Math.max(0, Math.min(maxMs, current))}
          onValueChange={(value) => {
            const next = Math.round(value);
            setDragMs(next);
            onPreview({ id: marker.id, atMs: next });
          }}
          onSlidingComplete={(value) => {
            haptic.tap();
            onReposition(marker.id, Math.round(value));
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
          accessibilityLabel={t("player.nudgePinForward")}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.textStrong} />
        </Pressable>
      </View>
    </View>
  );
}

/** Name + note editor for a pin — mirrors SectionDetailModal (note instead of colour). */
export function PinDetailModal({
  visible,
  initialName,
  initialNote,
  onConfirm,
  onDelete,
  onClose,
}: {
  visible: boolean;
  initialName: string;
  initialNote: string;
  onConfirm: (edits: { label: string; note: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState(initialNote);
  const prevVisible = React.useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setName(initialName);
      setNote(initialNote);
    }
    prevVisible.current = visible;
  }, [visible, initialName, initialNote]);
  return (
    <WarmModal visible={visible} onRequestClose={onClose} title={t("player.editPin")}>
      <UserTextInput
        style={s.sectionEditInput}
        value={name}
        onChangeText={setName}
        placeholder={t("player.pinName")}
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
      />
      <UserTextInput
        style={[s.sectionEditInput, s.pinDetailNoteInput]}
        value={note}
        onChangeText={setNote}
        placeholder={t("player.noteOptional")}
        placeholderTextColor={colors.textMuted}
        multiline
      />
      <View style={s.sectionModalActions}>
        {onDelete ? (
          <Pressable
            style={s.sectionModalDelete}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={t("player.deletePin")}
          >
            <Ionicons name="trash-outline" size={17} color={colors.danger} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable style={s.sectionModalCancel} onPress={onClose} accessibilityRole="button">
          <Text style={s.sectionModalCancelText}>{t("common.cancel")}</Text>
        </Pressable>
        <Pressable
          style={s.sectionModalConfirm}
          onPress={() => onConfirm({ label: name.trim(), note: note.trim() })}
          accessibilityRole="button"
        >
          <Text style={s.sectionModalConfirmText}>{t("common.save")}</Text>
        </Pressable>
      </View>
    </WarmModal>
  );
}
