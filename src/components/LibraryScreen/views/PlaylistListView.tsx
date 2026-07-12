import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import type { Playlist } from "../../../types";

function formatPlaylistUpdatedAt(timestamp: number) {
  const now = Date.now();
  const ageHours = Math.max(0, Math.floor((now - timestamp) / 3600000));
  if (ageHours < 1) return "just now";
  if (ageHours < 24) return `${ageHours}h ago`;
  const ageDays = Math.floor(ageHours / 24);
  if (ageDays < 7) return `${ageDays}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PlaylistListView({
  playlists,
  onCreatePlaylist,
  onOpenPlaylist,
}: {
  playlists: Playlist[];
  onCreatePlaylist: () => void;
  onOpenPlaylist: (playlistId: string) => void;
}) {
  const playerDockHeight = useStore((s) => s.playerDockHeight);

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={[styles.libraryScrollContent, { paddingBottom: 36 + playerDockHeight }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        style={({ pressed }) => [listStyles.createRow, pressed ? styles.pressDown : null]}
        onPress={onCreatePlaylist}
        accessibilityRole="button"
        accessibilityLabel="Create a new playlist"
      >
        <View style={listStyles.createIcon}>
          <Ionicons name="add" size={17} color={colors.onPrimary} />
        </View>
        <Text style={listStyles.createLabel}>New playlist</Text>
      </Pressable>

      <View style={listStyles.listStack}>
        {playlists.map((playlist) => (
          <Pressable
            key={playlist.id}
            style={({ pressed }) => [listStyles.playlistRow, pressed ? styles.pressDown : null]}
            onPress={() => onOpenPlaylist(playlist.id)}
          >
            <View style={listStyles.playlistArt}>
              <Ionicons name="musical-notes-outline" size={17} color={colors.primary} />
            </View>
            <View style={listStyles.playlistCopy}>
              <Text style={listStyles.playlistTitle} numberOfLines={1}>
                {playlist.title}
              </Text>
              <Text style={listStyles.playlistMeta} numberOfLines={1}>
                {playlist.items.length} {playlist.items.length === 1 ? "track" : "tracks"} ·{" "}
                {formatPlaylistUpdatedAt(playlist.updatedAt)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      {playlists.length === 0 ? (
        <View style={listStyles.emptyWrap}>
          <Ionicons name="musical-notes-outline" size={24} color={colors.textMuted} />
          <Text style={listStyles.emptyTitle}>Nothing to listen to yet</Text>
          <Text style={listStyles.emptyBody}>
            A playlist is an ordered listening queue — pull clips and songs from anywhere in your
            library and play them back to back.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const listStyles = StyleSheet.create({
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginBottom: spacing.sm,
  },
  createIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  createLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  listStack: {
    gap: spacing.sm,
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  playlistArt: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: "#F4ECE9",
    alignItems: "center",
    justifyContent: "center",
  },
  playlistCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  playlistTitle: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  playlistMeta: {
    ...textTokens.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  emptyWrap: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    ...textTokens.sectionTitle,
    color: colors.textPrimary,
  },
  emptyBody: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
