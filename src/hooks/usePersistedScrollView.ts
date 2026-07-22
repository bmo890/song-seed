import { useCallback, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

/** A mutable holder for a remembered scroll offset (e.g. a `useRef().current`). */
export type ScrollOffset = { current: number };

/**
 * Remember a ScrollView's vertical offset across remounts. The `offset` holder
 * must live in a component that does NOT remount with the list — e.g. the parent
 * screen — so the list can save into it on scroll and restore from it once its
 * content is measured on the next mount. Spread the returned props onto the
 * ScrollView.
 *
 * Restore happens on the first `onContentSizeChange` (once the content is tall
 * enough to hold the saved offset), instantly and without animation, then never
 * again — so later data changes don't yank the user back.
 */
export function usePersistedScrollView(offset?: ScrollOffset) {
  const ref = useRef<ScrollView>(null);
  const restored = useRef(false);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (offset) offset.current = event.nativeEvent.contentOffset.y;
    },
    [offset]
  );

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (!offset || restored.current) return;
      restored.current = true;
      if (offset.current > 0 && height > 0) {
        ref.current?.scrollTo({ y: offset.current, animated: false });
      }
    },
    [offset]
  );

  return { ref, onScroll, onContentSizeChange, scrollEventThrottle: 16 };
}
