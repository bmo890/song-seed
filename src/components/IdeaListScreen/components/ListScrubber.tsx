import { memo, useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import ReAnimated, {
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { durations } from "../../../design/motion";
import { haptic } from "../../../design/haptics";
import { useScrubLabel } from "../stickyDayStore";

/**
 * Fast-scroll scrubber for a long collection (2026-09-30).
 *
 * The convention of long grouped lists (Photos on both platforms): a short handle
 * at the trailing edge that appears while the list moves, fades a beat after it
 * stops, and can be grabbed to move at list speed; while held, a chip beside it
 * names where you are — the day or month under date sorts, the letter under
 * title sorts, nothing under length or progress sorts. Not the A–Z rail (busy,
 * and wrong for a date-sorted list) and not the native scrollbar drag (not
 * discoverable, and Android's is not exposed to React Native).
 *
 * The handle follows the list's shared scroll offset on the UI thread. A drag
 * asks the list to scroll (`scrollToOffset`, one call per gesture event); with
 * exact row geometry (listGeometry) the content is full-length, so the offset
 * lands anywhere in the list. The chip's text comes from the viewability
 * callback the sticky-day chip already uses.
 *
 * Haptics: `grab` on lift (picking the list up), `light` per section change
 * while held (the tick of an index rail), silent on release.
 *
 * Fabric hit-testing: a view at opacity 0 receives no touches, so the fade
 * lives on the handle and chip, never on the wrapper that carries the hit
 * area. Once faded out the wrapper steps off-screen (the stage clips it), so
 * an invisible handle never intercepts a scroll that starts at the edge.
 */

const HANDLE_HEIGHT = 44;
const HANDLE_WIDTH = 4;
const HANDLE_END_INSET = 8;
// Wide enough to catch a thumb that aims at a hairline; inset from the very edge
// so Android's back-swipe zone keeps the outermost pixels.
const HIT_WIDTH = 36;
const HIT_END_INSET = 4;
// The scrubber only earns its place on a list that takes real effort to scroll.
const MIN_CONTENT_TO_VIEWPORT = 1.8;
const HIDE_AFTER_MS = 1400;
// A drag asks the list to scroll at most this often (plus once on release):
// every intermediate position mounts a screen of cards, so a full-list sweep
// at 60 Hz spent a second of JS on rows nobody saw.
const DRAG_DISPATCH_MS = 50;
// Where the wrapper parks once invisible: past the stage's clipped edge.
const PARKED_OFFSET = 80;

type Props = {
  scrollY: SharedValue<number>;
  contentHeight: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  /** Height of the collapsible part of the header; the track starts below the pinned block. */
  collapsibleHeaderHeight: SharedValue<number>;
  /** Full header height (the list's top padding). */
  headerHeight: number;
  /** Space kept clear at the bottom for the floating dock and record button. */
  bottomInset: number;
  /** Scroll the list to a content offset (unanimated). */
  onScrollTo: (offset: number) => void;
};

function ListScrubberInner({
  scrollY,
  contentHeight,
  viewportHeight,
  collapsibleHeaderHeight,
  headerHeight,
  bottomInset,
  onScrollTo,
}: Props) {
  const { t } = useTranslation();
  const visible = useSharedValue(0);
  const grabbed = useSharedValue(0);
  const dragStartTop = useSharedValue(0);
  const dragTarget = useSharedValue(0);
  const lastDispatchAt = useSharedValue(0);

  // Show while the list moves; hide a beat after it stops, unless held.
  useAnimatedReaction(
    () => scrollY.value,
    (current, previous) => {
      if (previous === null || current === previous) return;
      if (contentHeight.value < viewportHeight.value * MIN_CONTENT_TO_VIEWPORT) return;
      visible.value = 1;
      if (grabbed.value === 0) {
        visible.value = withDelay(HIDE_AFTER_MS, withTiming(0, { duration: durations.base }));
      }
    }
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(1)
        .shouldCancelWhenOutside(false)
        .hitSlop({ horizontal: 8, vertical: 12 })
        .onBegin(() => {
          "worklet";
          grabbed.value = 1;
          visible.value = 1;
          const range = Math.max(1, contentHeight.value - viewportHeight.value);
          const trackTop = headerHeight - collapsibleHeaderHeight.value;
          const trackLength = Math.max(
            0,
            viewportHeight.value - bottomInset - trackTop - HANDLE_HEIGHT
          );
          const progress = Math.min(1, Math.max(0, scrollY.value / range));
          dragStartTop.value = trackTop + progress * trackLength;
          dragTarget.value = scrollY.value;
          lastDispatchAt.value = 0;
          runOnJS(haptic.grab)();
        })
        .onUpdate((event) => {
          "worklet";
          const range = Math.max(1, contentHeight.value - viewportHeight.value);
          const trackTop = headerHeight - collapsibleHeaderHeight.value;
          const trackLength = Math.max(
            1,
            viewportHeight.value - bottomInset - trackTop - HANDLE_HEIGHT
          );
          const progress = Math.min(
            1,
            Math.max(0, (dragStartTop.value + event.translationY - trackTop) / trackLength)
          );
          dragTarget.value = progress * range;
          const now = Date.now();
          if (now - lastDispatchAt.value < DRAG_DISPATCH_MS) return;
          lastDispatchAt.value = now;
          runOnJS(onScrollTo)(dragTarget.value);
        })
        .onFinalize(() => {
          "worklet";
          if (grabbed.value === 1) runOnJS(onScrollTo)(dragTarget.value);
          grabbed.value = 0;
          visible.value = withDelay(HIDE_AFTER_MS, withTiming(0, { duration: durations.base }));
        }),
    [
      bottomInset,
      collapsibleHeaderHeight,
      contentHeight,
      dragStartTop,
      dragTarget,
      lastDispatchAt,
      grabbed,
      headerHeight,
      onScrollTo,
      visible,
      scrollY,
      viewportHeight,
    ]
  );

  const rowStyle = useAnimatedStyle(() => {
    const range = Math.max(1, contentHeight.value - viewportHeight.value);
    const trackTop = headerHeight - collapsibleHeaderHeight.value;
    const trackLength = Math.max(0, viewportHeight.value - bottomInset - trackTop - HANDLE_HEIGHT);
    const progress = Math.min(1, Math.max(0, scrollY.value / range));
    return {
      transform: [
        { translateY: trackTop + progress * trackLength },
        // Parked off the clipped edge only once fully faded, so the step is never seen.
        { translateX: visible.value === 0 ? PARKED_OFFSET : 0 },
      ],
    };
  });

  const handleStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    backgroundColor: interpolateColor(grabbed.value, [0, 1], [colors.textMuted, colors.primary]),
    width: HANDLE_WIDTH + grabbed.value,
  }));

  const chipStyle = useAnimatedStyle(() => ({
    opacity: withTiming(grabbed.value, { duration: durations.fast }),
  }));

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <ReAnimated.View style={[styles.row, rowStyle]} pointerEvents="box-none">
        <ReAnimated.View style={chipStyle} pointerEvents="none">
          <ScrubChip grabbed={grabbed} />
        </ReAnimated.View>
        <GestureDetector gesture={pan}>
          <View
            style={styles.hit}
            accessibilityRole="adjustable"
            accessibilityLabel={t("collection.scrubber")}
          >
            <ReAnimated.View style={[styles.handle, handleStyle]} />
          </View>
        </GestureDetector>
      </ReAnimated.View>
    </View>
  );
}

/** The readout pill; re-renders only when the readout changes, and only exists
 *  while there is something to say (length and progress sorts have no readout). */
function ScrubChip({ grabbed }: { grabbed: SharedValue<number> }) {
  const label = useScrubLabel();
  useEffect(() => {
    // A section boundary crossed under the thumb ticks, like an index rail.
    if (grabbed.value === 1 && label) haptic.light();
  }, [grabbed, label]);
  if (!label) return null;
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export const ListScrubber = memo(ListScrubberInner);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  row: {
    position: "absolute",
    top: 0,
    end: 0,
    height: HANDLE_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  hit: {
    width: HIT_WIDTH,
    height: HANDLE_HEIGHT,
    marginEnd: HIT_END_INSET,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  handle: {
    height: HANDLE_HEIGHT,
    borderRadius: radii.round,
    marginEnd: HANDLE_END_INSET - HIT_END_INSET,
  },
  chip: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginEnd: spacing.sm,
    ...shadows.card,
  },
  chipText: {
    ...textTokens.caption,
    color: colors.textStrong,
    letterSpacing: 0.4,
  },
});
