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
  const visibleClipIdsKey = visibleClipEntries.map((entry) => entry.clip.id).join("|");

  useEffect(() => {
    const visibleIds = new Set(visibleClipEntries.map((entry) => entry.clip.id));
    const idsToAnimate = recentlyAddedItemIds.filter(
      (id) => visibleIds.has(id) && !animatingHighlightIdsRef.current.has(id)
    );

    idsToAnimate.forEach((id) => {
      animatingHighlightIdsRef.current.add(id);
      const animatedValue = new Animated.Value(0);
      highlightMapRef.current[id] = animatedValue;

      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 0.9,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]).start(() => {
        delete highlightMapRef.current[id];
        animatingHighlightIdsRef.current.delete(id);
        clearRecentlyAdded([id]);
      });
    });
  }, [clearRecentlyAdded, recentlyAddedItemIds, visibleClipEntries, visibleClipIdsKey]);

  return {
    getHighlightValue: (clipId: string) => highlightMapRef.current[clipId],
  };
}
