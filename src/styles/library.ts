import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors } from "../design/tokens";

// Library and workspace browsing: collections, playlists, pickers.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const libraryStyles = {
  workspaceBrowseSectionTitle: {
    fontSize: 11,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    paddingHorizontal: 4,
  },
  collectionMoveScroll: {
    maxHeight: 320,
  },
  collectionMoveScrollContent: {
    gap: 12,
    paddingTop: 10,
  },
  collectionMoveSection: {
    gap: 8,
  },
  // Destinations are rows on paper (2026-10-15): hairlines, the chosen one
  // marked by a terracotta radio and full weight, never a box.
  collectionMoveOptionList: {
    gap: 0,
  },
  collectionMoveOption: {
    minHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingHorizontal: 2,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  collectionMoveOptionSelected: {},
  collectionMoveOptionCopy: {
    flex: 1,
    gap: 2,
  },
  collectionMoveOptionTitle: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  collectionMoveOptionTitleSelected: {
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  collectionMoveOptionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  libraryScrollContent: {
    paddingBottom: 24,
    gap: 12,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
