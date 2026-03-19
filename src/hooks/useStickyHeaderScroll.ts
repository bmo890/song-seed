import { useCallback, useEffect, useRef } from "react";
import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";

type UseStickyHeaderScrollOptions = {
  onStickyChange?: (sticky: boolean) => void;
  getSnapY: () => number;
};

/**
 * Shared scroll logic for collapsing/expanding the song-detail header.
 *
 * Collapse: when user scrolls past the snap point (summary + primary sections).
 * Expand:   when user scrolls upward while near the top of the list.
 *
 * Uses direction detection + distance gating + consecutive-direction checks
 * to avoid jitter from layout reflow.
 * No programmatic scrollToOffset — native stickyHeaderIndices handles sticky.
 */
export function useStickyHeaderScroll({
  onStickyChange,
  getSnapY,
}: UseStickyHeaderScrollOptions) {
  const isStickyRef = useRef(false);
  const prevYRef = useRef(0);
  const lastChangeYRef = useRef(0);
  // Cooldown: when the header collapses/expands, the layout shift causes
  // the scroll offset to jump, which the handler would misread as the user
  // scrolling in the opposite direction.  Block state changes for 500ms
  // after each toggle so the animation settles before we re-evaluate.
  const cooldownUntilRef = useRef(0);
  // Consecutive-direction gating: require several frames moving in the same
  // direction before allowing a state change, filtering out single-frame
  // reversals caused by layout reflow.
  const consecutiveDirectionCountRef = useRef(0);
  const lastDirectionRef = useRef<"up" | "down" | null>(null);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const prevY = prevYRef.current;
      prevYRef.current = y;

      if (!onStickyChange) return;

      // Track consecutive scroll direction
      const direction: "up" | "down" | null =
        y > prevY ? "down" : y < prevY ? "up" : lastDirectionRef.current;
      if (direction === lastDirectionRef.current) {
        consecutiveDirectionCountRef.current += 1;
      } else {
        consecutiveDirectionCountRef.current = 1;
        lastDirectionRef.current = direction;
      }

      const now = Date.now();
      if (now < cooldownUntilRef.current) return;

      const snapY = getSnapY();

      // --- COLLAPSE: scrolled past the snap point ---
      if (
        !isStickyRef.current &&
        y > snapY &&
        snapY > 0 &&
        consecutiveDirectionCountRef.current >= 3
      ) {
        isStickyRef.current = true;
        lastChangeYRef.current = y;
        cooldownUntilRef.current = now + 500;
        onStickyChange(true);
        return;
      }

      // --- EXPAND: scrolling upward while well above the collapse point ---
      if (
        isStickyRef.current &&
        y < prevY &&
        consecutiveDirectionCountRef.current >= 3
      ) {
        const nearTop = y <= snapY - 40;
        const movedEnough = lastChangeYRef.current - y >= 30;
        if (nearTop && movedEnough) {
          isStickyRef.current = false;
          lastChangeYRef.current = y;
          cooldownUntilRef.current = now + 500;
          onStickyChange(false);
        }
      }
    },
    [onStickyChange, getSnapY]
  );

  // Reset on mount / unmount / callback change
  useEffect(() => {
    if (!onStickyChange) return;
    isStickyRef.current = false;
    prevYRef.current = 0;
    lastChangeYRef.current = 0;
    cooldownUntilRef.current = 0;
    consecutiveDirectionCountRef.current = 0;
    lastDirectionRef.current = null;
    onStickyChange(false);
    return () => {
      isStickyRef.current = false;
      prevYRef.current = 0;
      lastChangeYRef.current = 0;
      cooldownUntilRef.current = 0;
      consecutiveDirectionCountRef.current = 0;
      lastDirectionRef.current = null;
      onStickyChange(false);
    };
  }, [onStickyChange]);

  return { handleScroll, scrollEventThrottle: 16 } as const;
}
