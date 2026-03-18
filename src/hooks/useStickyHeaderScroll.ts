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
 * Uses direction detection + distance gating to avoid jitter.
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
  // scrolling in the opposite direction.  Block state changes for 300ms
  // after each toggle so the animation settles before we re-evaluate.
  const cooldownUntilRef = useRef(0);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const prevY = prevYRef.current;
      prevYRef.current = y;

      if (!onStickyChange) return;

      const now = Date.now();
      if (now < cooldownUntilRef.current) return;

      const snapY = getSnapY();

      // --- COLLAPSE: scrolled past the snap point ---
      if (!isStickyRef.current && y > snapY && snapY > 0) {
        isStickyRef.current = true;
        lastChangeYRef.current = y;
        cooldownUntilRef.current = now + 300;
        onStickyChange(true);
        return;
      }

      // --- EXPAND: scrolling upward while near the top ---
      if (isStickyRef.current && y < prevY) {
        const nearTop = y <= snapY + 20;
        const movedEnough = lastChangeYRef.current - y >= 8;
        if (nearTop && movedEnough) {
          isStickyRef.current = false;
          lastChangeYRef.current = y;
          cooldownUntilRef.current = now + 300;
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
    onStickyChange(false);
    return () => {
      isStickyRef.current = false;
      prevYRef.current = 0;
      lastChangeYRef.current = 0;
      cooldownUntilRef.current = 0;
      onStickyChange(false);
    };
  }, [onStickyChange]);

  return { handleScroll, scrollEventThrottle: 16 } as const;
}
