import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { styles } from "../styles";
import { fmtDuration } from "../../../utils";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { NowPlayingIndicator } from "../../common/NowPlayingIndicator";
import { useStore } from "../../../state/useStore";
import type { Playlist } from "../../../types";
import type { PlaylistTrack } from "../../../playlistPlayback";

function formatTotalDuration(ms: number | null) {
  if (ms == null) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} hr ${rest} min` : `${hours} hr`;
}

function formatUpdatedAt(timestamp: number) {
  const ageHours = Math.max(0, Math.floor((Date.now() - timestamp) / 3600000));
  if (ageHours < 1) return "updated just now";
  if (ageHours < 24) return `updated ${ageHours}h ago`;
  const ageDays = Math.floor(ageHours / 24);
  if (ageDays < 7) return `updated ${ageDays}d ago`;
  return `updated ${new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/**
 * The playlist page as a media player: editorial header with one primary Play,
 * then simple numbered track rows — tap a row to play the playlist from there
 * (playback runs in the global mini dock). Reorder/remove live behind Edit.
 */
export function PlaylistDetailView({
  playlist,
  tracks,
  durationMs,
  nowPlayingItemId,
  isPlaying,
  editMode,
  onToggleEditMode,
  onTogglePlayback,
  onPlayFromTrack,
  onAddItems,
  onRename,
  onDelete,
  onRemoveItem,
  onReorderItems,
}: {
  playlist: Playlist;
  tracks: PlaylistTrack[];
  durationMs: number | null;
  nowPlayingItemId: string | null;
  isPlaying: boolean;
  editMode: boolean;
  onToggleEditMode: () => void;
  onTogglePlayback: () => void;
  onPlayFromTrack: (startItemId?: string) => void;
  onAddItems: () => void;
  onRename: () => void;
  onDelete: () => void;
  onRemoveItem: (itemId: string) => void;
  onReorderItems: (orderedItemIds: string[]) => void;
}) {
  const [menuVisible, setMenuVisible] = useState(false);
  // Keep the last tracks scrollable above the media dock once playback starts.
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  const isPlaylistActive = nowPlayingItemId != null;
  const playableCount = tracks.filter((track) => track.available).length;

  const metaParts = [
    `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"}`,
    formatTotalDuration(durationMs),
    formatUpdatedAt(playlist.updatedAt),
  ].filter(Boolean);

  const header = (
    <View style={detailStyles.header}>
      <Text style={detailStyles.eyebrow}>Playlist</Text>
      <Text style={detailStyles.title} numberOfLines={2}>
        {playlist.title}
      </Text>
      <Text style={detailStyles.meta}>{metaParts.join("  ·  ")}</Text>

      <View style={detailStyles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            detailStyles.playBtn,
            playableCount === 0 ? detailStyles.playBtnDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => {
            haptic.tap();
            if (isPlaylistActive) {
              onTogglePlayback();
            } else {
              onPlayFromTrack();
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={isPlaylistActive && isPlaying ? "Pause" : "Play playlist"}
        >
          <Ionicons
            name={isPlaylistActive && isPlaying ? "pause" : "play"}
            size={22}
            color={colors.onPrimary}
            style={isPlaylistActive && isPlaying ? null : detailStyles.playIconNudge}
          />
        </Pressable>

        <Pressable
          style={({ pressed }) => [detailStyles.quietBtn, pressed ? styles.pressDown : null]}
          onPress={onAddItems}
          accessibilityRole="button"
          accessibilityLabel="Add tracks — browse your library"
        >
          <Ionicons name="add" size={19} color={colors.textStrong} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            detailStyles.quietBtn,
            editMode ? detailStyles.quietBtnActive : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onToggleEditMode}
          accessibilityRole="button"
          accessibilityLabel={editMode ? "Done editing" : "Edit playlist"}
        >
          <Ionicons
            name={editMode ? "checkmark" : "pencil"}
            size={16}
            color={editMode ? colors.onPrimary : colors.textStrong}
          />
        </Pressable>

        <View style={detailStyles.actionSpacer} />

        <Pressable
          style={({ pressed }) => [detailStyles.quietBtn, pressed ? styles.pressDown : null]}
          onPress={() => setMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Playlist options"
        >
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textStrong} />
        </Pressable>
      </View>

      {editMode ? (
        <Text style={detailStyles.editHint}>Drag the handle to reorder · tap − to remove</Text>
      ) : null}
    </View>
  );

  return (
    <>
      <DraggableFlatList
        data={tracks}
        keyExtractor={(track) => track.itemId}
        onDragBegin={haptic.grab}
        onDragEnd={({ data }) => onReorderItems(data.map((track) => track.itemId))}
        contentContainerStyle={[styles.libraryScrollContent, { paddingBottom: 36 + playerDockHeight }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={detailStyles.emptyWrap}>
            <Ionicons name="musical-notes-outline" size={26} color={colors.textMuted} />
            <Text style={detailStyles.emptyTitle}>No tracks yet</Text>
            <Text style={detailStyles.emptyBody}>
              Browse your library, preview clips, and add the keepers here.
            </Text>
            <Pressable
              style={({ pressed }) => [detailStyles.emptyAddBtn, pressed ? styles.pressDown : null]}
              onPress={onAddItems}
            >
              <Ionicons name="add" size={15} color={colors.onPrimary} />
              <Text style={detailStyles.emptyAddLabel}>Add tracks</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: track, drag, isActive, getIndex }) => {
          const isNowPlaying = track.itemId === nowPlayingItemId;
          const index = (getIndex() ?? 0) + 1;

          return (
            <View style={[detailStyles.trackRow, isActive ? detailStyles.trackRowDragging : null]}>
              {editMode ? (
                <Pressable
                  style={({ pressed }) => [detailStyles.removeBtn, pressed ? styles.pressDown : null]}
                  onPress={() => onRemoveItem(track.itemId)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${track.title}`}
                >
                  <Ionicons name="remove-circle-outline" size={19} color="#B4574A" />
                </Pressable>
              ) : (
                <View style={detailStyles.trackNum}>
                  {isNowPlaying ? (
                    <NowPlayingIndicator playing={isPlaying} color={colors.primary} />
                  ) : (
                    <Text style={detailStyles.trackNumText}>{index}</Text>
                  )}
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  detailStyles.trackMain,
                  pressed && !editMode && track.available ? styles.pressDown : null,
                ]}
                onPress={() => {
                  if (editMode || !track.available) return;
                  haptic.tap();
                  onPlayFromTrack(track.itemId);
                }}
                disabled={editMode || !track.available}
                accessibilityRole="button"
                accessibilityLabel={
                  track.available ? `Play from ${track.title}` : `${track.title} (unavailable)`
                }
              >
                <Text
                  style={[
                    detailStyles.trackTitle,
                    isNowPlaying ? detailStyles.trackTitleActive : null,
                    !track.available ? detailStyles.trackTitleMissing : null,
                  ]}
                  numberOfLines={1}
                >
                  {track.title}
                </Text>
                <Text
                  style={[detailStyles.trackContext, !track.available ? detailStyles.trackContextMissing : null]}
                  numberOfLines={1}
                >
                  {track.available ? track.context : "Unavailable — skipped during playback"}
                </Text>
              </Pressable>

              {track.durationMs != null && track.available ? (
                <Text style={[detailStyles.trackDuration, isNowPlaying ? detailStyles.trackDurationActive : null]}>
                  {fmtDuration(track.durationMs)}
                </Text>
              ) : null}

              {editMode ? (
                <Pressable
                  style={({ pressed }) => [detailStyles.dragHandle, pressed ? styles.pressDown : null]}
                  onLongPress={drag}
                  delayLongPress={120}
                  accessibilityRole="button"
                  accessibilityLabel={`Reorder ${track.title}`}
                >
                  <Ionicons name="reorder-three" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />

      <SelectionActionSheet
        visible={menuVisible}
        title="Playlist options"
        onClose={() => setMenuVisible(false)}
        actions={[
          {
            key: "rename",
            label: "Rename playlist",
            icon: "pencil-outline",
            onPress: onRename,
          },
          {
            key: "delete",
            label: "Delete playlist",
            icon: "trash-outline",
            tone: "danger",
            onPress: onDelete,
          },
        ]}
      />
    </>
  );
}

const detailStyles = StyleSheet.create({
  header: {
    paddingTop: 2,
    paddingBottom: 14,
  },
  eyebrow: {
    ...textTokens.annotation,
    color: colors.primary,
    marginBottom: 4,
  },
  title: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 32,
    lineHeight: 38,
    color: colors.textPrimary,
  },
  meta: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    marginTop: 6,
    fontVariant: ["tabular-nums"],
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: 16,
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnDisabled: {
    opacity: 0.4,
  },
  playIconNudge: {
    marginLeft: 3,
  },
  quietBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  quietBtnActive: {
    backgroundColor: colors.primary,
  },
  actionSpacer: {
    flex: 1,
  },
  editHint: {
    ...textTokens.caption,
    color: colors.textMuted,
    marginTop: 12,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.page,
  },
  trackRowDragging: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.sm,
  },
  trackNum: {
    width: 24,
    alignItems: "center",
  },
  trackNumText: {
    ...textTokens.supporting,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  trackMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  trackTitle: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  trackTitleActive: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
  trackTitleMissing: {
    color: colors.textMuted,
  },
  trackContext: {
    ...textTokens.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  trackContextMissing: {
    color: colors.textMuted,
    fontStyle: "italic",
  },
  trackDuration: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  trackDurationActive: {
    color: colors.primary,
  },
  removeBtn: {
    width: 24,
    alignItems: "center",
  },
  dragHandle: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 40,
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
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 6,
  },
  emptyAddLabel: {
    ...textTokens.caption,
    color: colors.onPrimary,
    fontFamily: "PlusJakartaSans_700Bold",
  },
});
