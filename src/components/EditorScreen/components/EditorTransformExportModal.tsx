import React from "react";
import { colors, radii } from "../../../design/tokens";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { TitleInput } from "../../common/TitleInput";
import { styles } from "../../../styles";
import { formatPitchShiftLabel } from "../../../domain/pitchShift";
import { useTranslation } from "react-i18next";

type EditorTransformExportModalProps = {
  visible: boolean;
  targetIdeaKind: "project" | "clip" | null;
  targetIdeaTitle: string | null;
  pitchShiftSemitones: number;
  playbackRate: number;
  nameDraft: string;
  suggestedExportTitle: string;
  removeOriginalAfterExport: boolean;
  onClose: () => void;
  onChangeNameDraft: (value: string) => void;
  onToggleRemoveOriginalAfterExport: () => void;
  onSave: () => void;
};

function formatPlaybackRate(value: number) {
  return `${value.toFixed(2)}x`;
}

export function EditorTransformExportModal({
  visible,
  targetIdeaKind,
  targetIdeaTitle,
  pitchShiftSemitones,
  playbackRate,
  nameDraft,
  suggestedExportTitle,
  removeOriginalAfterExport,
  onClose,
  onChangeNameDraft,
  onToggleRemoveOriginalAfterExport,
  onSave,
}: EditorTransformExportModalProps) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, transformModalStyles.modalCard]}>
          <Text style={styles.title}>{t("editor.saveTransform")}</Text>
          <Text style={[styles.cardMeta, { marginBottom: 10 }]}>
            {targetIdeaKind === "project"
              ? t("editor.transformProject", { title: targetIdeaTitle })
              : t("editor.transformFolder", { title: targetIdeaTitle ?? t("editor.thisFolder") })}
          </Text>

          <View style={transformModalStyles.summaryCard}>
            <View style={transformModalStyles.summaryRow}>
              <Text style={transformModalStyles.summaryLabel}>{t("editor.pitch")}</Text>
              <Text style={transformModalStyles.summaryValue}>{formatPitchShiftLabel(pitchShiftSemitones)}</Text>
            </View>
            <View style={transformModalStyles.summaryRow}>
              <Text style={transformModalStyles.summaryLabel}>{t("editor.speed")}</Text>
              <Text style={transformModalStyles.summaryValue}>{formatPlaybackRate(playbackRate)}</Text>
            </View>
          </View>

          <Text style={[styles.cardMeta, { marginBottom: 6 }]}>{t("editor.transformedName")}</Text>
          <TitleInput
            value={nameDraft}
            onChangeText={onChangeNameDraft}
            placeholder={suggestedExportTitle}
          />

          <Text style={[styles.cardMeta, { marginTop: 8 }]}>
            {t("editor.autoNameHint")}
          </Text>

          <Pressable
            style={transformModalStyles.checkboxRow}
            onPress={onToggleRemoveOriginalAfterExport}
          >
            <Feather
              name={removeOriginalAfterExport ? "check-square" : "square"}
              size={18}
              color={removeOriginalAfterExport ? colors.primary : colors.textMuted}
            />
            <Text style={transformModalStyles.checkboxLabel}>
              {t("editor.deleteOriginal")}
            </Text>
          </Pressable>

          <Text style={[styles.cardMeta, { marginTop: 12 }]}>
            {removeOriginalAfterExport
              ? targetIdeaKind === "project"
                ? t("editor.transformedReplaceProject")
                : t("editor.transformedReplaceClip")
              : targetIdeaKind === "project"
                ? t("editor.transformedKeepProject")
                : t("editor.transformedKeepClip")}
          </Text>

          <View style={[styles.rowButtons, { justifyContent: "flex-end", marginTop: 16 }]}>
            <Button variant="secondary" label={t("common.cancel")} onPress={onClose} />
            <Button label={t("editor.saveTransform")} onPress={onSave} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const transformModalStyles = StyleSheet.create({
  modalCard: {
    width: "92%",
    maxHeight: "84%",
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textPrimary,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
