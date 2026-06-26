import { useRef } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";
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

const TAP_SLOP = 6;

/** A chord symbol anchored above a character. In edit mode the token claims the
 * touch on press-down — so the surrounding horizontal ScrollView never steals the
 * drag (which is why dragging only worked at a scroll extreme before). A release
 * that barely moved is treated as a tap (edit); a real drag re-anchors the chord
 * and commits on release. */
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
  const draggingRef = useRef(false);
  const baseLeft = clampChordIndex(chord.at, lineLength) * charWidth;

  const panResponder = useRef(
    PanResponder.create({
      // Claim the touch at the start (capture phase) so the parent scroll view
      // can't grab the horizontal gesture first.
      onStartShouldSetPanResponder: () => editable,
      onStartShouldSetPanResponderCapture: () => editable,
      onMoveShouldSetPanResponder: () => editable,
      onMoveShouldSetPanResponderCapture: () => editable,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        draggingRef.current = false;
      },
      onPanResponderMove: (_evt, gesture) => {
        if (!draggingRef.current && Math.abs(gesture.dx) > TAP_SLOP) {
          draggingRef.current = true;
          onDragStateChange?.(true);
          void Haptics.selectionAsync();
        }
        if (draggingRef.current) translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const wasDragging = draggingRef.current;
        draggingRef.current = false;
        translateX.setValue(0);
        if (!wasDragging) {
          onPress?.();
          return;
        }
        onDragStateChange?.(false);
        const nextAt = clampChordIndex(chord.at + gesture.dx / Math.max(charWidth, 1), lineLength);
        if (nextAt !== chord.at) onMove?.(nextAt);
      },
      onPanResponderTerminate: () => {
        if (draggingRef.current) onDragStateChange?.(false);
        draggingRef.current = false;
        translateX.setValue(0);
      },
    })
  ).current;

  if (!editable) {
    return (
      <View style={[styles.wrap, { left: baseLeft }]} pointerEvents="none">
        <View style={styles.chip}>
          <Text style={styles.text}>{chord.chord}</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View
      style={[styles.wrap, styles.wrapEditable, { left: baseLeft - GRAB, transform: [{ translateX }] }]}
      {...panResponder.panHandlers}
    >
      <View style={styles.chip}>
        <Text style={styles.text}>{chord.chord}</Text>
      </View>
    </Animated.View>
  );
}

/** Invisible padding around the chip that enlarges the drag target. The wrap is
 * shifted left by this amount so the chip stays aligned to its character. */
const GRAB = 8;

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
  },
  wrapEditable: {
    // A wider invisible grab area makes the small chip easy to catch and drag.
    paddingLeft: GRAB,
    paddingRight: GRAB,
    paddingTop: 2,
    paddingBottom: 8,
  },
  chip: {
    alignSelf: "flex-start",
    backgroundColor: chordChartColors.chord,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  text: {
    fontFamily: MONO_FONT,
    fontSize: CHORD_FONT_SIZE,
    lineHeight: CHORD_FONT_SIZE + 4,
    color: chordChartColors.chordText,
    fontWeight: "700",
  },
});
