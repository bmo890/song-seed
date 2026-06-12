import { useCallback, useRef, type ReactNode } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

type CollapsingHeaderOverlayProps = {
  /** Active scroll offset (UI thread). */
  scrollY: SharedValue<number>;
  /** Measured height of the collapsible group — written here, read by the clamp + nav fade. */
  collapsibleHeight: SharedValue<number>;
  /** Content that scrolls up and clips away under the nav. */
  collapsible: ReactNode;
  /** Content that stays docked under the nav once collapsed (e.g. the filter toolbar). */
  pinned?: ReactNode;
  /** Reports total header height (collapsible + pinned) so the scroll can pad its top. */
  onHeaderHeight?: (total: number) => void;
};

/**
 * Absolutely-positioned header that translates up on scroll using only
 * `transform` (GPU-composited — never per-frame layout). Because it is out of
 * flow it cannot resize the scroll view beneath it, so there is no feedback loop:
 * content scrolls 1:1 and the header re-expands perfectly at the top.
 *
 * The owning "stage" must set `overflow: "hidden"` so the collapsible group is
 * clipped as it slides up under the nav, and must pad its scroll content by the
 * reported header height.
 *
 * Stability details:
 * - Scroll offsets are clamped at 0 in the worklet so overscroll/bounce (negative
 *   offsets) can never push the header *down* — that reads as up-down jitter.
 * - Measured heights are rounded to whole px. Android reports fractional dp that
 *   can oscillate between layout passes; feeding that back into paddingTop would
 *   shift content mid-scroll (another micro-jitter source).
 */
export function CollapsingHeaderOverlay({
  scrollY,
  collapsibleHeight,
  collapsible,
  pinned,
  onHeaderHeight,
}: CollapsingHeaderOverlayProps) {
  const collapsibleHRef = useRef(0);
  const pinnedHRef = useRef(0);

  const report = useCallback(() => {
    onHeaderHeight?.(collapsibleHRef.current + pinnedHRef.current);
  }, [onHeaderHeight]);

  const onCollapsibleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = Math.round(e.nativeEvent.layout.height);
      if (h === collapsibleHRef.current) return;
      collapsibleHRef.current = h;
      collapsibleHeight.value = h;
      report();
    },
    [collapsibleHeight, report]
  );

  const onPinnedLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = Math.round(e.nativeEvent.layout.height);
      if (h === pinnedHRef.current) return;
      pinnedHRef.current = h;
      report();
    },
    [report]
  );

  const animatedStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.value);
    return {
      transform: [{ translateY: -Math.min(y, collapsibleHeight.value) }],
    };
  });

  return (
    <Animated.View
      style={[
        { position: "absolute", top: 0, left: 0, right: 0, zIndex: 50 },
        animatedStyle,
      ]}
      // box-none lets drags on empty header areas fall through to the scroll
      // view beneath, while buttons/tabs still capture their own taps.
      pointerEvents="box-none"
    >
      <View pointerEvents="box-none" onLayout={onCollapsibleLayout}>
        {collapsible}
      </View>
      {pinned ? (
        <View pointerEvents="box-none" onLayout={onPinnedLayout}>
          {pinned}
        </View>
      ) : null}
    </Animated.View>
  );
}
