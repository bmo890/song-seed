import React from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../../design/tokens";

type EditorExportProgressModalProps = {
  visible: boolean;
};

export function EditorExportProgressModal({ visible }: EditorExportProgressModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.title}>Exporting audio…</Text>
          <Text style={styles.subtitle}>This happens entirely on your device</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(27,28,26,0.45)",
    justifyContent: "center",
    alignItems: "center",
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
    marginTop: spacing.md,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
