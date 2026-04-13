import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button } from "../common/Button";
import { TitleInput } from "../common/TitleInput";
import { styles } from "../../styles";
import { formatPitchShiftLabel } from "../../pitchShift";

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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, transformModalStyles.modalCard]}>
          <Text style={styles.title}>Save Transform</Text>
          <Text style={[styles.cardMeta, { marginBottom: 10 }]}>
            {targetIdeaKind === "project"
              ? `Render a transformed clip version back into ${targetIdeaTitle}.`
              : `Render a transformed clip back into ${targetIdeaTitle ?? "this folder"} as a new clip card.`}
          </Text>

          <View style={transformModalStyles.summaryCard}>
            <View style={transformModalStyles.summaryRow}>
              <Text style={transformModalStyles.summaryLabel}>Pitch</Text>
              <Text style={transformModalStyles.summaryValue}>{formatPitchShiftLabel(pitchShiftSemitones)}</Text>
            </View>
            <View style={transformModalStyles.summaryRow}>
              <Text style={transformModalStyles.summaryLabel}>Speed</Text>
              <Text style={transformModalStyles.summaryValue}>{formatPlaybackRate(playbackRate)}</Text>
            </View>
          </View>

          <Text style={[styles.cardMeta, { marginBottom: 6 }]}>Transformed clip name</Text>
          <TitleInput
            value={nameDraft}
            onChangeText={onChangeNameDraft}
            placeholder={suggestedExportTitle}
          />

          <Text style={[styles.cardMeta, { marginTop: 8 }]}>
            Leave empty to use the next auto-generated version name.
          </Text>

          <Pressable
            style={transformModalStyles.checkboxRow}
            onPress={onToggleRemoveOriginalAfterExport}
          >
            <Feather
              name={removeOriginalAfterExport ? "check-square" : "square"}
              size={18}
              color={removeOriginalAfterExport ? "#2563eb" : "#9ca3af"}
            />
            <Text style={transformModalStyles.checkboxLabel}>
              Delete the original clip after saving
            </Text>
          </Pressable>

          <Text style={[styles.cardMeta, { marginTop: 12 }]}>
            {removeOriginalAfterExport
              ? targetIdeaKind === "project"
                ? "The original source version will be removed and the transformed version will stay in this song."
                : "The original clip card will be removed and the transformed clip will stay in this ideas list."
              : targetIdeaKind === "project"
                ? "The original source version stays in place and the transformed result is added as a new version."
                : "The original clip stays in place and the transformed result is added as a new clip card."}
          </Text>

          <View style={[styles.rowButtons, { justifyContent: "flex-end", marginTop: 16 }]}>
            <Button variant="secondary" label="Cancel" onPress={onClose} />
            <Button label="Save Transform" onPress={onSave} />
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
    borderColor: "#e5e7eb",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
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
    fontWeight: "600",
    color: "#475569",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: "#4b5563",
  },
});
