import React from "react";
import { StyleSheet } from "react-native";
import { Button } from "../../common/Button";
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
 * step depending on the mode and intent. It opens the save step rather than
 * committing, so it wears the tonal primary; solid primary is reserved for the
 * confirm in the sheet that actually writes the clips. */
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
    <Button
      variant="primary"
      label={label}
      disabled={!enabled}
      onPress={onPress}
      style={s.cta}
      accessibilityState={{ disabled: !enabled }}
    />
  );
}

const s = StyleSheet.create({
  cta: { alignSelf: "stretch" },
});
