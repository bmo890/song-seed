import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../design/directionalIcons";
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

  // `restore` must run OUTSIDE the state updater: updaters can execute during
  // the render phase, and a restore that writes another store from there trips
  // React's "cannot update a component while rendering" warning. Reading `hist`
  // from the closure is safe — undo/redo are re-created whenever it changes.
  const undo = useCallback(() => {
    if (hist.undo.length === 0) return;
    const prev = hist.undo[hist.undo.length - 1];
    setHist({ undo: hist.undo.slice(0, -1), redo: [...hist.redo.slice(-39), current] });
    restore(prev);
  }, [hist, restore, current]);

  const redo = useCallback(() => {
    if (hist.redo.length === 0) return;
    const next = hist.redo[hist.redo.length - 1];
    setHist({ undo: [...hist.undo.slice(-39), current], redo: hist.redo.slice(0, -1) });
    restore(next);
  }, [hist, restore, current]);

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
        <Ionicons name={dirIcon("arrow-undo-outline")} size={17} color={canUndo ? colors.textStrong : colors.borderMuted} />
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
        <Ionicons name={dirIcon("arrow-redo-outline")} size={17} color={canRedo ? colors.textStrong : colors.borderMuted} />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { width: 32, height: 32, borderRadius: radii.round, alignItems: "center", justifyContent: "center" },
});
