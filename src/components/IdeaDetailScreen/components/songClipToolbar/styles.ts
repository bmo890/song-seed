import { StyleSheet } from "react-native";
import { colors } from "../../../../design/tokens";

export const songClipToolbarStyles = StyleSheet.create({
  headerStack: {
    gap: 8,
    overflow: "visible",
    zIndex: 130,
    elevation: 13,
  },
  // Fixed height shared with selectionRow: swapping the controls for the
  // selection controls must not change the toolbar's height, or every take
  // below it shifts when you enter selection.
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    minHeight: 38,
    zIndex: 130,
    elevation: 13,
    overflow: "visible",
  },
  controlsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginEnd: -8,
  },
  // Filter popover hangs from the row's trailing edge, where its trigger sits
  // (the left in Hebrew), so it stays on screen in both directions.
  menuOffsetRight: {
    end: 0,
    top: 38,
  },
  // Selection-mode controls row: same slot and height as the view switch, so
  // toggling selection never reflows the takes list.
  selectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 38,
  },
  selectionCount: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"] as const,
  },
  selectionAll: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: colors.primaryDeep,
  },
  selectionCancel: {
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  selectionCancelText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textStrong,
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
    marginEnd: 2,
  },
});
