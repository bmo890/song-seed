import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { NowPlayingIndicator } from "../../common/NowPlayingIndicator";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { fmtDuration } from "../../../utils";
import { getClipPlaybackDurationMs } from "../../../domain/clipPresentation";
import type { Songbook } from "../../../types";
import { availableViewsForSong, type SongbookSong } from "../../../domain/songbookGrouping";

type SongbookDetailViewProps = {
  songbook: Songbook;
  songs: SongbookSong[];
  nowPlayingIdeaId: string | null;
  isPlaying: boolean;
  onOpenReader: (startIdeaId?: string) => void;
  onPlaySong: (song: SongbookSong) => void;
  onAddSongs: () => void;
  onReorderSongs: (orderedIdeaIds: string[]) => void;
  onRemoveSong: (song: SongbookSong) => void;
  onRename: () => void;
  onShareFile?: () => void;
  onShareText: () => void;
  onDelete: () => void;
};

/** The book of your songs — one row per song, chart-kind chips, reference audio
 *  a tap away, and the reader behind the big open button. Design mirrors
 *  PlaylistDetailView so the Library's tabs read as one family. */
export function SongbookDetailView({
  songbook,
  songs,
  nowPlayingIdeaId,
  isPlaying,
  onOpenReader,
  onPlaySong,
  onAddSongs,
  onReorderSongs,
  onRemoveSong,
  onRename,
  onShareFile,
  onShareText,
  onDelete,
}: SongbookDetailViewProps) {
  const [editMode, setEditMode] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // "Readable" = the reader can actually show something for it (a live chart),
  // not merely that the song still exists — keeps the row and the reader in
  // agreement about what opens.
  const isReadable = (song: SongbookSong) =>
    song.available && availableViewsForSong(song).length > 0;
  const readableCount = songs.filter(isReadable).length;
  const chordCount = songs.filter((song) => song.hasChordChart).length;
  const metaParts = [
    `${songs.length} ${songs.length === 1 ? "song" : "songs"}`,
    ...(chordCount > 0 ? [`${chordCount} with chords`] : []),
  ];

  const header = (
    <View style={bookStyles.header}>
      <Text style={bookStyles.eyebrow}>Songbook</Text>
      <Text style={bookStyles.title} numberOfLines={2}>
        {songbook.title}
      </Text>
      <Text style={bookStyles.meta}>{metaParts.join("  ·  ")}</Text>

      <View style={bookStyles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            bookStyles.readBtn,
            readableCount === 0 ? bookStyles.readBtnDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => {
            haptic.tap();
            onOpenReader();
          }}
          disabled={readableCount === 0}
          accessibilityRole="button"
          accessibilityLabel="Open the book"
        >
          <Ionicons name="book-outline" size={21} color={colors.onPrimary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [bookStyles.quietBtn, pressed ? styles.pressDown : null]}
          onPress={onAddSongs}
          accessibilityRole="button"
          accessibilityLabel="Add songs to this book"
        >
          <Ionicons name="add" size={19} color={colors.textStrong} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            bookStyles.quietBtn,
            editMode ? bookStyles.quietBtnActive : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => setEditMode((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={editMode ? "Done editing" : "Edit book"}
        >
          <Ionicons
            name={editMode ? "checkmark" : "pencil"}
            size={16}
            color={editMode ? colors.onPrimary : colors.textStrong}
          />
        </Pressable>

        <View style={bookStyles.actionSpacer} />

        <Pressable
          style={({ pressed }) => [bookStyles.quietBtn, pressed ? styles.pressDown : null]}
          onPress={() => setMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Songbook options"
        >
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textStrong} />
        </Pressable>
      </View>

      {editMode ? (
        <Text style={bookStyles.editHint}>Drag the handle to reorder · tap − to remove</Text>
      ) : null}
    </View>
  );

  return (
    <>
      <DraggableFlatList
        data={songs}
        keyExtractor={(song) => song.ideaId}
        onDragBegin={haptic.grab}
        onDragEnd={({ data }) => onReorderSongs(data.map((song) => song.ideaId))}
        contentContainerStyle={[styles.libraryScrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={bookStyles.emptyWrap}>
            <Ionicons name="book-outline" size={26} color={colors.textMuted} />
            <Text style={bookStyles.emptyTitle}>Nothing in this book yet</Text>
            <Text style={bookStyles.emptyBody}>
              Add finished songs — their final lyrics and chords live here, read like a book.
            </Text>
            <Pressable
              style={({ pressed }) => [bookStyles.emptyAddBtn, pressed ? styles.pressDown : null]}
              onPress={onAddSongs}
            >
              <Ionicons name="add" size={15} color={colors.onPrimary} />
              <Text style={bookStyles.emptyAddLabel}>Add songs</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: song, drag, isActive }: RenderItemParams<SongbookSong>) => {
          const isNowPlaying = song.ideaId === nowPlayingIdeaId;
          const durationMs = song.playableClip
            ? getClipPlaybackDurationMs(song.playableClip)
            : null;

          return (
            <View style={[bookStyles.songRow, isActive ? bookStyles.songRowDragging : null]}>
              {editMode ? (
                <Pressable
                  style={({ pressed }) => [bookStyles.removeBtn, pressed ? styles.pressDown : null]}
                  onPress={() => onRemoveSong(song)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${song.title} from the book`}
                >
                  <Ionicons name="remove-circle-outline" size={19} color="#B4574A" />
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    bookStyles.rowPlay,
                    !song.playableClip ? bookStyles.rowPlayDisabled : null,
                    pressed && song.playableClip ? styles.pressDown : null,
                  ]}
                  onPress={() => {
                    if (!song.playableClip) return;
                    haptic.tap();
                    onPlaySong(song);
                  }}
                  disabled={!song.playableClip}
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${song.title}`}
                >
                  {isNowPlaying ? (
                    <NowPlayingIndicator playing={isPlaying} color={colors.primary} size={12} />
                  ) : (
                    <Ionicons
                      name="play"
                      size={12}
                      color={song.playableClip ? colors.textPrimary : colors.textMuted}
                      style={{ marginLeft: 1 }}
                    />
                  )}
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  bookStyles.rowMain,
                  pressed && !editMode && song.available ? styles.pressDown : null,
                ]}
                onPress={() => {
                  if (editMode || !isReadable(song)) return;
                  haptic.tap();
                  onOpenReader(song.ideaId);
                }}
                disabled={editMode || !isReadable(song)}
                accessibilityRole="button"
                accessibilityLabel={
                  isReadable(song) ? `Open ${song.title} in the book` : `${song.title} (unavailable)`
                }
              >
                <Text
                  style={[
                    bookStyles.rowTitle,
                    isNowPlaying ? bookStyles.rowTitleActive : null,
                    !song.available ? bookStyles.rowTitleMissing : null,
                  ]}
                  numberOfLines={1}
                >
                  {song.title}
                </Text>
                <View style={bookStyles.chipRow}>
                  {song.available ? (
                    <>
                      <Text style={[bookStyles.kindChip, song.hasLyricChart ? bookStyles.kindChipOn : null]}>
                        Lyrics
                      </Text>
                      <Text style={[bookStyles.kindChip, song.hasChordChart ? bookStyles.kindChipOn : null]}>
                        Chords
                      </Text>
                    </>
                  ) : (
                    <Text style={bookStyles.missingText}>No longer in the library</Text>
                  )}
                </View>
              </Pressable>

              {durationMs != null && song.available && !editMode ? (
                <Text style={bookStyles.rowDuration}>{fmtDuration(durationMs)}</Text>
              ) : null}

              {editMode ? (
                <Pressable
                  style={({ pressed }) => [bookStyles.dragHandle, pressed ? styles.pressDown : null]}
                  onLongPress={drag}
                  delayLongPress={120}
                  accessibilityRole="button"
                  accessibilityLabel={`Reorder ${song.title}`}
                >
                  <Ionicons name="reorder-three" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : (
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              )}
            </View>
          );
        }}
      />

      <SelectionActionSheet
        visible={menuVisible}
        title="Songbook options"
        onClose={() => setMenuVisible(false)}
        actions={[
          {
            key: "rename",
            label: "Rename book",
            icon: "pencil-outline",
            onPress: onRename,
          },
          ...(onShareFile
            ? [
                {
                  key: "share-file",
                  label: "Share as file",
                  icon: "share-outline" as const,
                  onPress: onShareFile,
                },
              ]
            : []),
          {
            key: "share-text",
            label: "Share as text",
            icon: "document-text-outline",
            onPress: onShareText,
          },
          {
            key: "delete",
            label: "Delete book",
            icon: "trash-outline",
            tone: "danger",
            onPress: onDelete,
          },
        ]}
      />
    </>
  );
}

const bookStyles = StyleSheet.create({
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
  readBtn: {
    width: 52,
    height: 52,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  readBtnDisabled: {
    opacity: 0.4,
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
    marginTop: 10,
  },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  songRowDragging: {
    opacity: 0.92,
  },
  rowPlay: {
    width: 30,
    height: 30,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  rowPlayDisabled: {
    opacity: 0.45,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  rowTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowTitleActive: {
    color: colors.primaryDeep,
  },
  rowTitleMissing: {
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: "row",
    gap: 5,
  },
  kindChip: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 8.5,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.textSecondary,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 4,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    overflow: "hidden",
  },
  kindChipOn: {
    color: colors.primaryDeep,
    backgroundColor: "#FDF5F2",
    borderWidth: 1,
    borderColor: "#EBD3CE",
    paddingVertical: 1.5,
    paddingHorizontal: 6,
  },
  missingText: {
    ...textTokens.caption,
    color: colors.textMuted,
  },
  rowDuration: {
    ...textTokens.caption,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  removeBtn: {
    width: 30,
    alignItems: "center",
  },
  dragHandle: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  emptyWrap: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
  },
  emptyBody: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  emptyAddLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.onPrimary,
  },
});
