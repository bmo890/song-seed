import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { PlayerScreen, type PlayerSheetNavigation } from "./PlayerScreen";
import { useStore } from "../state/useStore";
import { usePlayerSheetPosition } from "../hooks/PlayerSheetPositionProvider";
import { colors } from "../design/tokens";

/** Root routes that legitimately open ON TOP of the player (trim, re-record,
 *  lyric/chord editing…). The sheet hides beneath them but stays mounted, so
 *  audio and player state survive the round-trip and it reappears on back. */
const OBSCURING_ROUTES = new Set([
  "Editor",
  "Recording",
  "BluetoothCalibration",
  "Lyrics",
  "LyricsVersion",
  "ChordSheet",
  "ClipLineage",
  "ShareImport",
]);

const OPEN_DURATION = 300;
const CLOSE_DURATION = 240;

type PlayerSheetProps = {
  activeRouteName: string;
  isDrawerOpen: boolean;
  /** Root-navigator navigate, provided by App (the sheet lives outside any
   *  navigator, like the dock). */
  navigateRoot: (routeName: string, params?: object) => void;
};

/**
 * The full player as a root-level SHEET — a sibling of the media dock.
 *
 * It is PRE-MOUNTED (docked off the bottom) the whole time a playback session is
 * active, so a swipe-up reveals it instantly instead of waiting for this heavy
 * tree to mount mid-drag. `isPlayerScreenMounted` now means "expanded" (the
 * sheet is up and owns playback); presence in the tree is driven by whether
 * there's an active queue. Vertical position is the shared `dragY` (0 = fully
 * open, screenHeight = docked) — shared with the dock so drag-up (dock) and
 * drag-down (header) move one value.
 */
export function PlayerSheet({ activeRouteName, isDrawerOpen, navigateRoot }: PlayerSheetProps) {
  const expanded = useStore((s) => s.isPlayerScreenMounted);
  const hasSession = useStore((s) => !!s.playerTarget && s.playerQueue.length > 0);
  const present = expanded || hasSession;
  const obscured = OBSCURING_ROUTES.has(activeRouteName) || isDrawerOpen;
  const isActive = expanded && !obscured;
  const { dragY, dockedY, openedByDrag, inMotion, setInMotion } = usePlayerSheetPosition();

  // Expanding: slide up from wherever the sheet is (docked, or mid-drag). Skipped
  // when a dock drag-up already drove dragY there (openedByDrag).
  useEffect(() => {
    if (!expanded) return;
    if (openedByDrag.value) {
      openedByDrag.value = false;
      return;
    }
    setInMotion(true);
    dragY.value = withTiming(0, { duration: OPEN_DURATION }, (finished) => {
      if (finished) runOnJS(setInMotion)(false);
    });
  }, [dragY, expanded, openedByDrag, setInMotion]);

  const sheetNavigation = useMemo<PlayerSheetNavigation>(() => {
    // Plain JS callbacks so the withTiming worklet only ever calls runOnJS(these),
    // never touches the store from the UI thread.
    const collapse = () => useStore.getState().setPlayerScreenMounted(false);
    const clearMotion = () => setInMotion(false);
    return {
      // Collapse animates the sheet down to docked, THEN clears the expanded
      // flag. If the session is still alive it stays docked (dock reappears); if
      // it was ended (audition/✕) the queue is already cleared, so clearing the
      // flag unmounts. One smooth exit for chevron, hardware back, and drag.
      goBack: () => {
        setInMotion(true);
        // Settle at the docked offset (behind the dock's top), not off the bottom,
        // so the next swipe-up lifts straight out from there.
        dragY.value = withTiming(dockedY.value, { duration: CLOSE_DURATION }, (finished) => {
          if (finished) {
            runOnJS(collapse)();
            runOnJS(clearMotion)();
          }
        });
      },
      canGoBack: () => true,
      navigate: (routeName, params) => navigateRoot(routeName, params),
    };
  }, [dragY, dockedY, navigateRoot, setInMotion]);

  const translateStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  return (
    // zIndex BELOW the media dock (50): the sheet rests behind the dock and lifts
    // out from its top edge, so a swipe-up reveals it immediately. When fully
    // expanded the dock is unmounted, so nothing sits over the player.
    <View style={sheetStyles.host} pointerEvents={isActive ? "auto" : "none"}>
      {present ? (
        <Animated.View
          style={[
            sheetStyles.sheet,
            translateStyle,
            // Keep mounted but invisible while an editing route or the drawer
            // sits on top — state and audio survive; it reappears on return.
            obscured ? sheetStyles.sheetHidden : null,
          ]}
        >
          <PlayerScreen
            navigation={sheetNavigation}
            isActive={isActive}
            dragY={dragY}
            sheetInMotion={inMotion}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  sheet: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.page,
  },
  sheetHidden: {
    opacity: 0,
  },
});
