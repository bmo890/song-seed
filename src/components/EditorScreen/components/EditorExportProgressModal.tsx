import React from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, text } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

type EditorExportProgressModalProps = {
  visible: boolean;
};

export function EditorExportProgressModal({ visible }: EditorExportProgressModalProps) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.fill}>
        {/* The scrim is its own layer so its opacity never dims the card. */}
        <View style={styles.scrim} />
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.title}>{t("editor.exporting")}</Text>
          <Text style={styles.subtitle}>{t("editor.onDevice")}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.textPrimary,
    opacity: 0.45,
  },
  card: {
    backgroundColor: colors.surface,
    paddingHorizontal: 32,
    paddingVertical: 28,
    borderRadius: radii.lg,
    alignItems: "center",
    maxWidth: 280,
  },
  title: {
    ...text.caption,
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  subtitle: {
    ...text.supporting,
    marginTop: spacing.xs,
    textAlign: "center",
  },
});
