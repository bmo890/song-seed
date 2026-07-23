import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../styles";
import { colors, radii } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { useTranslation } from "react-i18next";

/**
 * A small undo/redo history over one snapshot-able value (the Cut-Up table
 * pattern, shared). The owner calls `record(previous)` right before applying a
 * change, and gives `restore` to write a snapshot back. Capped at 40 steps.
 * Keystroke-level edits shouldn't be recorded — snapshot structural changes.
 */
export function useUndoHistory<T>(current: T, restore: (value: T) => void) {
  const [hist, setHist] = useState<{ undo: T[]; redo: T[] }>({ undo: [], redo: [] });

  const record = useCallback((previous: T) => {
    setHist((h) => ({ undo: [...h.undo.slice(-39), previous], redo: [] }));
  }, []);

  const undo = useCallback(() => {
    setHist((h) => {
      if (h.undo.length === 0) return h;
      const prev = h.undo[h.undo.length - 1];
      restore(prev);
      return { undo: h.undo.slice(0, -1), redo: [...h.redo.slice(-39), current] };
    });
  }, [restore, current]);

  const redo = useCallback(() => {
    setHist((h) => {
      if (h.redo.length === 0) return h;
      const next = h.redo[h.redo.length - 1];
      restore(next);
      return { undo: [...h.undo.slice(-39), current], redo: h.redo.slice(0, -1) };
    });
  }, [restore, current]);

  const clear = useCallback(() => setHist({ undo: [], redo: [] }), []);

  return { record, undo, redo, clear, canUndo: hist.undo.length > 0, canRedo: hist.redo.length > 0 };
}

/** The matching pair of quiet icon buttons. */
export function UndoRedoButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed ? appStyles.pressDown : null]}
        onPress={() => {
          haptic.tap();
          onUndo();
        }}
        disabled={!canUndo}
        hitSlop={6}
        accessibilityLabel={t("wordSparks.undo")}
      >
        <Ionicons name="arrow-undo-outline" size={17} color={canUndo ? colors.textStrong : colors.borderMuted} />
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed ? appStyles.pressDown : null]}
        onPress={() => {
          haptic.tap();
          onRedo();
        }}
        disabled={!canRedo}
        hitSlop={6}
        accessibilityLabel={t("wordSparks.redo")}
      >
        <Ionicons name="arrow-redo-outline" size={17} color={canRedo ? colors.textStrong : colors.borderMuted} />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { width: 32, height: 32, borderRadius: radii.round, alignItems: "center", justifyContent: "center" },
});
