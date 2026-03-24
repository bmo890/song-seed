import { useCallback, useRef } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";

type UseScrollCollapseHeaderOptions = {
  /** Minimum scroll-down distance before collapsing (default 60) */
  collapseThreshold?: number;
  /** Minimum scroll-up distance before expanding (default 12) */
  expandThreshold?: number;
  /** Animation duration in ms (default 200) */
  duration?: number;
};

/**
 * Drives a header-collapse animation from scroll events of an external
 * ScrollView / FlatList that lives *below* the header (not inside it).
 *
 * Returns:
 *  - `handleScroll`  – attach to your scroll component's `onScroll`
 *  - `scrollEventThrottle` – pass to scroll component
 *  - `collapsed`     – current boolean state
 *  - `animStyle`     – animated style with `opacity` and `maxHeight` for
 *                       the collapsible header section
 *  - `progress`      – shared value 0 (expanded) → 1 (collapsed), if you
 *                       need finer-grained custom animations
 */
export function useScrollCollapseHeader(opts?: UseScrollCollapseHeaderOptions) {
  const collapseThreshold = opts?.collapseThreshold ?? 60;
  const expandThreshold = opts?.expandThreshold ?? 12;
  const duration = opts?.duration ?? 200;

  const collapsedRef = useRef(false);
  const prevYRef = useRef(0);
  const directionYRef = useRef(0); // y where current direction started
  const cooldownUntilRef = useRef(0);

  const progress = useSharedValue(0); // 0 = expanded, 1 = collapsed

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const prevY = prevYRef.current;
      prevYRef.current = y;

      const now = Date.now();
      if (now < cooldownUntilRef.current) return;

      const scrollingDown = y > prevY;
      const scrollingUp = y < prevY;

      // Detect direction change → reset anchor
      if (
        (scrollingDown && prevY <= directionYRef.current) ||
        (scrollingUp && prevY >= directionYRef.current)
      ) {
        directionYRef.current = prevY;
      }

      // COLLAPSE: scrolling down and moved enough
      if (!collapsedRef.current && scrollingDown && y > collapseThreshold) {
        const distDown = y - directionYRef.current;
        if (distDown >= collapseThreshold) {
          collapsedRef.current = true;
          cooldownUntilRef.current = now + 300;
          progress.value = withTiming(1, { duration });
        }
      }

      // EXPAND: scrolling up and moved enough, or scrolled back to top
      if (collapsedRef.current && scrollingUp) {
        const distUp = directionYRef.current - y;
        if (distUp >= expandThreshold || y <= 0) {
          collapsedRef.current = false;
          cooldownUntilRef.current = now + 300;
          progress.value = withTiming(0, { duration });
        }
      }
    },
    [collapseThreshold, expandThreshold, duration, progress]
  );

  const animStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    // Interpolate maxHeight so the collapse is smooth with no hard breakpoint jump
    maxHeight: interpolate(progress.value, [0, 1], [500, 0]),
    overflow: "hidden" as const,
  }));

  return {
    handleScroll,
    scrollEventThrottle: 16,
    collapsed: collapsedRef,
    animStyle,
    progress,
  } as const;
}
