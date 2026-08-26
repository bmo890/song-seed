import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { usePersistedScrollView, type ScrollOffset } from "../../../hooks/usePersistedScrollView";
import type { Playlist } from "../../../types";
import { useTranslation } from "react-i18next";
import { i18n } from "../../../i18n/instance";
import { Button } from "../../common/Button";
import { EmptyState } from "../../common/EmptyState";

function formatPlaylistUpdatedAt(timestamp: number) {
  const now = Date.now();
  const ageHours = Math.max(0, Math.floor((now - timestamp) / 3600000));
  if (ageHours < 1) return i18n.t("library.updatedNow");
  if (ageHours < 24) return i18n.t("library.updatedHours", { count: ageHours });
  const ageDays = Math.floor(ageHours / 24);
  if (ageDays < 7) return i18n.t("library.updatedDays", { count: ageDays });
  const locale = i18n.language === "he" ? "he-IL" : "en-US";
  return i18n.t("library.updatedDate", {
    date: new Date(timestamp).toLocaleDateString(locale, { month: "short", day: "numeric" }),
  });
}

export function PlaylistListView({
  playlists,
  onCreatePlaylist,
  onOpenPlaylist,
  scroll,
}: {
  playlists: Playlist[];
  onCreatePlaylist: () => void;
  onOpenPlaylist: (playlistId: string) => void;
  scroll?: ScrollOffset;
}) {
  const { t } = useTranslation();
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  const { ref: scrollRef, ...scrollHandlers } = usePersistedScrollView(scroll);

  return (
    <ScrollView
      ref={scrollRef}
      {...scrollHandlers}
      style={styles.flexFill}
      contentContainerStyle={[styles.libraryScrollContent, { paddingBottom: 36 + playerDockHeight }]}
      showsVerticalScrollIndicator={false}
    >
      {/* One creation affordance per state: the soft key when there's a list,
          the empty state's own action when there isn't — same law as the other
          two Compilations tabs (2026-08-26 audit B10). */}
      {playlists.length > 0 ? (
        <View style={styles.inputRow}>
          <Button label={t("library.newPlaylistShort")} onPress={onCreatePlaylist} />
        </View>
      ) : null}

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
                {t("library.tracks", { count: playlist.items.length })} ·{" "}
                {formatPlaylistUpdatedAt(playlist.updatedAt)}
              </Text>
            </View>
            <Ionicons name={dirIcon("chevron-forward")} size={15} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      {playlists.length === 0 ? (
        <EmptyState
          icon="musical-notes-outline"
          title={t("library.playlistEmpty")}
          body={t("library.playlistEmptyBody")}
          actionLabel={t("library.newPlaylistShort")}
          onAction={onCreatePlaylist}
        />
      ) : null}
    </ScrollView>
  );
}

const listStyles = StyleSheet.create({
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
    fontFamily: "Lora_500Medium",
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
});
