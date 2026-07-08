import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { PlayerScreen, type PlayerSheetNavigation } from "./PlayerScreen";
import { useStore } from "../state/useStore";
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

type PlayerSheetProps = {
  activeRouteName: string;
  isDrawerOpen: boolean;
  /** Root-navigator navigate, provided by App (the sheet lives outside any
   *  navigator, like the dock). */
  navigateRoot: (routeName: string, params?: object) => void;
};

/**
 * The full player as a root-level SHEET — a sibling of the media dock, not a
 * route. It exists while `isPlayerScreenMounted` is true (set by every
 * "open player" flow via setPlayerQueueForScreen) and collapsing simply clears
 * that flag: there is no back stack, so closing always reveals exactly the
 * screen you were on, with the session continuing in the dock.
 */
export function PlayerSheet({ activeRouteName, isDrawerOpen, navigateRoot }: PlayerSheetProps) {
  const mounted = useStore((s) => s.isPlayerScreenMounted);
  const obscured = OBSCURING_ROUTES.has(activeRouteName) || isDrawerOpen;

  const sheetNavigation = useMemo<PlayerSheetNavigation>(
    () => ({
      goBack: () => useStore.getState().setPlayerScreenMounted(false),
      canGoBack: () => true,
      navigate: (routeName, params) => navigateRoot(routeName, params),
    }),
    [navigateRoot]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={mounted && !obscured ? "auto" : "none"}>
      {mounted ? (
        <Animated.View
          entering={SlideInDown.duration(260)}
          exiting={SlideOutDown.duration(220)}
          style={[
            sheetStyles.sheet,
            // Keep mounted but invisible while an editing route or the drawer
            // sits on top — state and audio survive; it reappears on return.
            obscured ? sheetStyles.sheetHidden : null,
          ]}
        >
          <PlayerScreen navigation={sheetNavigation} isActive={!obscured} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  sheet: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.page,
  },
  sheetHidden: {
    opacity: 0,
  },
});
