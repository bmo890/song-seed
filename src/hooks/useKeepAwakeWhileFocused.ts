import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

/**
 * Keep the screen lit while this page is the one in front (2026-10-18). For
 * the pages that sit on a music stand, the songbook reader and a setlist
 * song: a phone that locks mid-song is a phone you have to touch on stage.
 * Released on blur, so it never outlives the page.
 */
export function useKeepAwakeWhileFocused(tag: string) {
  useFocusEffect(
    useCallback(() => {
      activateKeepAwakeAsync(tag).catch(() => {});
      return () => {
        try {
          void deactivateKeepAwake(tag);
        } catch {
          // no-op where keep-awake is unavailable (web)
        }
      };
    }, [tag])
  );
}
