import type { Ionicons } from "@expo/vector-icons";

type CollectorKind = "playlist" | "songbook" | "setlist";

const KIND_ICONS: Record<CollectorKind, keyof typeof Ionicons.glyphMap> = {
  playlist: "musical-notes-outline",
  songbook: "book-outline",
  setlist: "albums-outline",
};

/** The glyph a collecting compilation wears on the picker eyebrow — the same
 *  family the Compilations hub uses for each kind. */
export function getLibraryCollectorIcon(kind: CollectorKind): keyof typeof Ionicons.glyphMap {
  return KIND_ICONS[kind];
}
