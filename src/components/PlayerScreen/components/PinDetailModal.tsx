import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../design/tokens";
import { MAX_PIN_LABEL_LENGTH } from "../../../domain/practicePinLayout";
import { WarmModal } from "../../common/WarmModal";
import { playerScreenStyles as s } from "../styles";
import { useTranslation } from "react-i18next";
import { UserTextInput } from "../../../i18n";

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
        maxLength={MAX_PIN_LABEL_LENGTH}
        returnKeyType="done"
      />
      {/* The limit is a layout fact (the badge is drawn this wide on the tape), so
          the count appears once you're near it rather than nagging from empty.
          A pin named before the limit tightened can still open over it — saving
          trims to fit, so that state has to read as a warning, not as normal. */}
      {name.length >= MAX_PIN_LABEL_LENGTH - 5 ? (
        <Text
          style={[
            s.pinNameCount,
            name.length > MAX_PIN_LABEL_LENGTH ? s.pinNameCountOver : null,
          ]}
        >
          {t("player.pinNameCount", { used: name.length, max: MAX_PIN_LABEL_LENGTH })}
        </Text>
      ) : null}
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
