import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii } from "../../design/tokens";
import { styles as appStyles } from "../../styles";

type EditorFooterSectionProps = {
  editorMode: "trim" | "transform";
  intent: "keep" | "remove";
  keepCount: number;
  removeCount: number;
  hasActiveTransforms: boolean;
  onExport: () => void;
  onSaveTransform: () => void;
};

/** One contextual primary action — the editor always has a single obvious next
 * step depending on the mode and intent. */
export function EditorFooterSection({
  editorMode,
  intent,
  keepCount,
  removeCount,
  hasActiveTransforms,
  onExport,
  onSaveTransform,
}: EditorFooterSectionProps) {
  let label: string;
  let enabled: boolean;
  let onPress: () => void;

  if (editorMode === "transform") {
    label = "Save as new clip";
    enabled = hasActiveTransforms;
    onPress = onSaveTransform;
  } else if (intent === "keep") {
    label = keepCount > 0 ? `Extract ${keepCount} clip${keepCount === 1 ? "" : "s"}` : "Extract clips";
    enabled = keepCount > 0;
    onPress = onExport;
  } else {
    label = "Save trimmed clip";
    enabled = removeCount > 0;
    onPress = onExport;
  }

  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      style={({ pressed }) => [
        s.cta,
        !enabled ? s.ctaDisabled : null,
        pressed && enabled ? appStyles.pressDown : null,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
    >
      <Text style={[s.ctaText, !enabled ? s.ctaTextDisabled : null]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { backgroundColor: colors.surfaceHigh },
  ctaText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: colors.onPrimary,
  },
  ctaTextDisabled: { color: colors.textMuted },
});
