import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles } from "../../styles";

type EditorFooterSectionProps = {
  activeExportCount: number;
  hasActiveTransforms: boolean;
  onAddSelection: () => void;
  onOpenExport: () => void;
  onOpenTransformExport: () => void;
};

export function EditorFooterSection({
  activeExportCount,
  hasActiveTransforms,
  onAddSelection,
  onOpenExport,
  onOpenTransformExport,
}: EditorFooterSectionProps) {
  return (
    <View style={styles.transportFooterCard}>
      <View style={styles.transportFooterMeta}>
        <Text style={styles.transportFooterEyebrow}>Sticky Controls</Text>
        <Text style={styles.transportFooterTitle}>
          {activeExportCount > 0 ? `${activeExportCount} export${activeExportCount === 1 ? "" : "s"} ready` : "Build edit regions"}
        </Text>
      </View>
      <View style={styles.transportFooterRow}>
        <Pressable
          onPress={onAddSelection}
          style={({ pressed }) => [
            styles.transportFooterButton,
            pressed ? styles.pressDown : null,
          ]}
        >
          <Text style={styles.transportFooterButtonText}>Add Selection</Text>
        </Pressable>
        <Pressable
          onPress={onOpenExport}
          style={({ pressed }) => [
            styles.transportFooterButton,
            styles.transportFooterButtonSecondary,
            activeExportCount === 0 ? styles.transportFooterButtonDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          disabled={activeExportCount === 0}
        >
          <Text style={[styles.transportFooterButtonText, styles.transportFooterButtonTextSecondary]}>Export</Text>
        </Pressable>
        <Pressable
          onPress={onOpenTransformExport}
          style={({ pressed }) => [
            styles.transportFooterButton,
            editorFooterStyles.transformButton,
            !hasActiveTransforms ? styles.transportFooterButtonDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          disabled={!hasActiveTransforms}
        >
          <Text style={styles.transportFooterButtonText}>Save Transform</Text>
        </Pressable>
      </View>
    </View>
  );
}

const editorFooterStyles = StyleSheet.create({
  transformButton: {
    flex: 1,
  },
});
