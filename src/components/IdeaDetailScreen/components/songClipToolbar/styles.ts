import { StyleSheet } from "react-native";
import { colors } from "../../../../design/tokens";

export const songClipToolbarStyles = StyleSheet.create({
  headerStack: {
    gap: 8,
    overflow: "visible",
    zIndex: 130,
    elevation: 13,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 130,
    elevation: 13,
    overflow: "visible",
  },
  controlsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  // SegmentedControl segments are flex:1 — cap the track so the trailing
  // glyphs always keep their room.
  viewToggleWrap: {
    flexShrink: 1,
    width: 220,
    maxWidth: "70%",
  },
  // Filter popover hangs from the row's trailing edge (the trigger now sits
  // at the far right), so anchor right to keep it on screen.
  menuOffsetRight: {
    right: 0,
    top: 38,
  },
  filterClearText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.primary,
  },
  customTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 2,
  },
});
