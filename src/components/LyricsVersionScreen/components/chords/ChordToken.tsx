import { useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";
import type { ChordPlacement } from "../../../../types";
import { clampChordIndex } from "../../../../chords";
import { CHORD_FONT_SIZE, MONO_FONT, chordChartColors } from "./chordChartStyle";

type Props = {
  chord: ChordPlacement;
  charWidth: number;
  lineLength: number;
  editable: boolean;
  onPress?: () => void;
  onMove?: (at: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
};

/** A chord symbol anchored above a character. In edit mode it can be tapped
 * (edit) or dragged horizontally to re-anchor; the move commits on release so
 * persistence isn't churned on every frame. */
export function ChordToken({
  chord,
  charWidth,
  lineLength,
  editable,
  onPress,
  onMove,
  onDragStateChange,
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const baseLeft = clampChordIndex(chord.at, lineLength) * charWidth;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        editable && Math.abs(gesture.dx) > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      // Capture horizontal moves that start on the chord before the surrounding
      // horizontal ScrollView can claim them, so dragging a chord never scrolls.
      onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
        editable && Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        onDragStateChange?.(true);
        void Haptics.selectionAsync();
      },
      onPanResponderMove: (_evt, gesture) => {
        translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_evt, gesture) => {
        onDragStateChange?.(false);
        const nextAt = clampChordIndex(chord.at + gesture.dx / Math.max(charWidth, 1), lineLength);
        translateX.setValue(0);
        if (nextAt !== chord.at) onMove?.(nextAt);
      },
      onPanResponderTerminate: () => {
        onDragStateChange?.(false);
        translateX.setValue(0);
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.wrap, { left: baseLeft, transform: [{ translateX }] }]}
      {...(editable ? panResponder.panHandlers : {})}
    >
      <Pressable
        onPress={editable ? onPress : undefined}
        hitSlop={editable ? { top: 8, bottom: 4, left: 6, right: 6 } : undefined}
        style={({ pressed }) => [styles.chip, editable && pressed ? styles.chipPressed : null]}
      >
        <Text style={styles.text} numberOfLines={1}>
          {chord.chord}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
  },
  chip: {
    alignSelf: "flex-start",
    backgroundColor: chordChartColors.chord,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  chipPressed: {
    opacity: 0.7,
  },
  text: {
    fontFamily: MONO_FONT,
    fontSize: CHORD_FONT_SIZE,
    lineHeight: CHORD_FONT_SIZE + 4,
    color: chordChartColors.chordText,
    fontWeight: "700",
  },
});
