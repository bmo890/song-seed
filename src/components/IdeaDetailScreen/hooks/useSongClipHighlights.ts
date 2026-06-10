import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { useStore } from "../../../state/useStore";
import { type EvolutionListClipEntry, type TimelineClipEntry } from "../../../clipGraph";

export function useSongClipHighlights(
  visibleClipEntries: Array<TimelineClipEntry | EvolutionListClipEntry>
) {
  const recentlyAddedItemIds = useStore((s) => s.recentlyAddedItemIds);
  const clearRecentlyAdded = useStore((s) => s.clearRecentlyAdded);
  const highlightMapRef = useRef<Record<string, Animated.Value>>({});
  const animatingHighlightIdsRef = useRef<Set<string>>(new Set());

  // ── Eager allocation ──────────────────────────────────────────────────────
  // Create Animated.Values synchronously during render so cards can reference
  // them in the same render pass. Effects only start the animation; they never
  // need to create a value that a card is waiting on.
  const visibleIds = new Set(visibleClipEntries.map((e) => e.clip.id));

  for (const id of visibleIds) {
    if (!highlightMapRef.current[id]) {
      highlightMapRef.current[id] = new Animated.Value(0);
    }
  }
  // Prune entries for clips no longer visible and not mid-animation.
  for (const id of Object.keys(highlightMapRef.current)) {
    if (!visibleIds.has(id) && !animatingHighlightIdsRef.current.has(id)) {
      delete highlightMapRef.current[id];
    }
  }

  const visibleClipIdsKey = visibleClipEntries.map((e) => e.clip.id).join("|");

  // ── Fire animations ───────────────────────────────────────────────────────
  useEffect(() => {
    const currentVisibleIds = new Set(visibleClipEntries.map((e) => e.clip.id));
    const idsToAnimate = recentlyAddedItemIds.filter(
      (id) => currentVisibleIds.has(id) && !animatingHighlightIdsRef.current.has(id)
    );

    idsToAnimate.forEach((id) => {
      const animatedValue = highlightMapRef.current[id];
      if (!animatedValue) return;

      animatingHighlightIdsRef.current.add(id);
      animatedValue.setValue(0);

      Animated.sequence([
        // Fast fade-in so the highlight is visible immediately.
        Animated.timing(animatedValue, {
          toValue: 0.9,
          duration: 180,
          useNativeDriver: true,
        }),
        // Hold at full brightness for a moment, then fade out slowly.
        Animated.delay(400),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        animatedValue.setValue(0);
        animatingHighlightIdsRef.current.delete(id);
        clearRecentlyAdded([id]);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearRecentlyAdded, recentlyAddedItemIds, visibleClipIdsKey]);

  return {
    getHighlightValue: (clipId: string): Animated.Value | null =>
      highlightMapRef.current[clipId] ?? null,
  };
}
