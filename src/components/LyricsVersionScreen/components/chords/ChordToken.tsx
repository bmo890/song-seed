import { useLayoutEffect, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";
import type { ChordPlacement } from "../../../../types";
import { chordGraphemeAnchor, clampChordIndex } from "../../../../domain/chords";
import { CHORD_FONT_SIZE, MONO_FONT, chordChartColors } from "./chordChartStyle";
import { haptic } from "../../../../design/haptics";

type Props = {
  chord: ChordPlacement;
  charWidth: number;
  lineLength: number;
  editable: boolean;
  zoom?: number;
  onPress?: () => void;
  onMove?: (at: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
};

const TAP_SLOP = 6;
/** Invisible padding around the chip that enlarges the drag target. The chip's
 * left edge stays pinned to its character; this just extends the touchable area. */
const GRAB = 8;

/** A chord symbol anchored above a character by its LEFT edge. In edit mode the
 * token claims the touch on press-down — so the surrounding horizontal ScrollView
 * never steals the drag. A release that barely moved is a tap (edit); a real drag
 * snaps to the nearest character and commits.
 *
 * Position is driven entirely by one Animated value (`posX`) rather than a React
 * `left` + transform, so the committed anchor and the live drag offset can never
 * desync into a one-frame jump. The PanResponder reads the latest anchor/metrics
 * through refs, so re-dragging a chord always measures from where it actually is. */
export function ChordToken({
  chord,
  charWidth,
  lineLength,
  editable,
  zoom = 1,
  onPress,
  onMove,
  onDragStateChange,
}: Props) {
  const chordTextStyle = { fontSize: CHORD_FONT_SIZE * zoom, lineHeight: (CHORD_FONT_SIZE + 4) * zoom };
  const base = clampChordIndex(chord.graphemeAt ?? chord.at, lineLength);
  const baseLeft = base * charWidth;
  const restX = baseLeft - GRAB;

  const posX = useRef(new Animated.Value(restX)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const draggingRef = useRef(false);
  const [active, setActive] = useState(false);

  // Latest values for the once-created PanResponder to read, avoiding stale
  // closures that made a re-dragged chord compute its move from a prior anchor.
  const baseRef = useRef(base);
  const restXRef = useRef(restX);
  const cwRef = useRef(charWidth);
  const lenRef = useRef(lineLength);
  const onMoveRef = useRef(onMove);
  const onPressRef = useRef(onPress);
  const onDragRef = useRef(onDragStateChange);
  baseRef.current = base;
  restXRef.current = restX;
  cwRef.current = charWidth;
  lenRef.current = lineLength;
  onMoveRef.current = onMove;
  onPressRef.current = onPress;
  onDragRef.current = onDragStateChange;

  // Glue the chip to its committed anchor whenever that changes (a move commit, a
  // re-measure, or a text edit that shifts the anchor) — but never yank it
  // mid-drag. Because posX is the single source of truth, the value we set on
  // release equals the value this restores, so the commit is seamless.
  useLayoutEffect(() => {
    if (!draggingRef.current) posX.setValue(restX);
  }, [restX, posX]);

  const lift = (up: boolean) => {
    setActive(up);
    Animated.spring(scale, {
      toValue: up ? 1.18 : 1,
      useNativeDriver: true,
      friction: 6,
      tension: 180,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      // Claim the touch at the start (capture phase) so the parent scroll view
      // can't grab the horizontal gesture first.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        draggingRef.current = false;
      },
      onPanResponderMove: (_evt, gesture) => {
        if (!draggingRef.current && Math.abs(gesture.dx) > TAP_SLOP) {
          draggingRef.current = true;
          onDragRef.current?.(true);
          lift(true);
          haptic.tap();
        }
        if (draggingRef.current) posX.setValue(restXRef.current + gesture.dx);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const wasDragging = draggingRef.current;
        draggingRef.current = false;
        if (!wasDragging) {
          onPressRef.current?.();
          return;
        }
        lift(false);
        onDragRef.current?.(false);
        const cw = Math.max(cwRef.current, 1);
        const target = clampChordIndex(baseRef.current + gesture.dx / cw, lenRef.current);
        // Land exactly on the nearest character (where the left edge is), then
        // commit. Setting posX before the move means the commit's re-render
        // restores the same pixel — no jump back toward the old anchor.
        posX.setValue(target * cwRef.current - GRAB);
        if (target !== baseRef.current) onMoveRef.current?.(target);
      },
      onPanResponderTerminate: () => {
        if (draggingRef.current) {
          onDragRef.current?.(false);
          lift(false);
        }
        draggingRef.current = false;
        posX.setValue(restXRef.current);
      },
    })
  ).current;

  if (!editable) {
    return (
      <View style={[styles.wrap, { left: baseLeft }]} pointerEvents="none">
        <View style={styles.chip}>
          <Text style={[styles.text, chordTextStyle]}>{chord.chord}</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View
      style={[styles.wrap, styles.wrapEditable, { transform: [{ translateX: posX }] }]}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={[styles.chip, active ? styles.chipActive : null, { transform: [{ scale }] }]}
      >
        <Text style={[styles.text, chordTextStyle]}>{chord.chord}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
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
    // Grow from the left edge so the active "lift" never shifts the anchor.
    transformOrigin: "left center",
  },
  chipActive: {
    backgroundColor: chordChartColors.chordActive,
  },
  text: {
    // Deliberate exception to the "no bare fontWeight" rule: chord tokens render in the
    // platform monospace font (column alignment), which is a system font and synthesizes
    // bold correctly.
    fontFamily: MONO_FONT,
    fontWeight: "700",
    fontSize: CHORD_FONT_SIZE,
    lineHeight: CHORD_FONT_SIZE + 4,
    color: chordChartColors.chordText,
  },
});
