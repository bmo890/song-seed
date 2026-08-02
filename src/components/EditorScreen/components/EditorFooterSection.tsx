import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii } from "../../../design/tokens";
import { styles as appStyles } from "../../../styles";
import { useTranslation } from "react-i18next";

type EditorFooterSectionProps = {
  editorMode: "trim" | "transform";
  intent: "keep" | "remove";
  keepCount: number;
  removeCount: number;
  /** True when the removals cover the whole clip — there would be nothing left. */
  removesEverything: boolean;
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
  removesEverything,
  hasActiveTransforms,
  onExport,
  onSaveTransform,
}: EditorFooterSectionProps) {
  const { t } = useTranslation();
  let label: string;
  let enabled: boolean;
  let onPress: () => void;

  if (editorMode === "transform") {
    label = t("editor.saveNewClip");
    enabled = hasActiveTransforms;
    onPress = onSaveTransform;
  } else if (intent === "keep") {
    label = keepCount > 0 ? t("editor.extractCount", { count: keepCount }) : t("editor.extractClips");
    enabled = keepCount > 0;
    onPress = onExport;
  } else if (removesEverything) {
    // Enabling this would fail at render time with a generic error; say why instead.
    label = t("editor.nothingLeft");
    enabled = false;
    onPress = onExport;
  } else {
    label = t("editor.saveTrimmed");
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
  /** Soft key, not a stadium pill (button language locked 2026-07-24). This opens the
   *  save step rather than committing, so it wears the tonal terracotta wash; solid
   *  primary is reserved for the confirm that actually writes the clips. */
  cta: {
    backgroundColor: colors.primarySurface,
    borderRadius: radii.lg,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { backgroundColor: colors.surfaceHigh },
  ctaText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: colors.primaryDeep,
  },
  ctaTextDisabled: { color: colors.textMuted },
});
