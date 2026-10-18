import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { styles } from "../styles";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { EmptyState } from "../../common/EmptyState";
import { SentLinkChip } from "../../common/SentLinkChip";
import { NowPlayingIndicator } from "../../common/NowPlayingIndicator";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { fmtDuration } from "../../../utils";
import { getClipPlaybackDurationMs } from "../../../domain/clipPresentation";
import type { Songbook } from "../../../types";
import { availableViewsForSong, type SongbookSong } from "../../../domain/songbookGrouping";
import { looksMachineNamed } from "../../../domain/titleNaming";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

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
  onGetLink?: () => void;
  onShareText: () => void;
  onDelete: () => void;
};

/** The book of your songs — one card per song, what it holds as a quiet line, reference audio
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
  onGetLink,
  onShareText,
  onDelete,
}: SongbookDetailViewProps) {
  const { t } = useTranslation();
  const [editMode, setEditMode] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  // Share… drills into a second sheet: a file, SongNook Send, or plain text.
  const [shareMenuVisible, setShareMenuVisible] = useState(false);

  // "Readable" = the reader can actually show something for it (a live chart),
  // not merely that the song still exists — keeps the row and the reader in
  // agreement about what opens.
  const isReadable = (song: SongbookSong) =>
    song.available && availableViewsForSong(song).length > 0;
  const readableCount = songs.filter(isReadable).length;
  const chordCount = songs.filter((song) => song.hasChordChart).length;
  const metaParts = [
    t("library.songs", { count: songs.length }),
    ...(chordCount > 0 ? [t("library.withChords", { count: chordCount })] : []),
  ];

  const header = (
    <View style={bookStyles.header}>
      <Text style={bookStyles.eyebrow}>{t("library.songbook")}</Text>
      <UserText value={songbook.title} style={bookStyles.title} numberOfLines={2}>
        {songbook.title}
      </UserText>
      <Text style={bookStyles.meta}>{metaParts.join("  ·  ")}</Text>

      <View style={bookStyles.linkChipRow}>
        <SentLinkChip entityId={songbook.id} />
      </View>

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
          accessibilityLabel={t("library.openBook")}
        >
          <Ionicons name="book-outline" size={21} color={colors.onPrimary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [bookStyles.quietBtn, pressed ? styles.pressDown : null]}
          onPress={onAddSongs}
          accessibilityRole="button"
          accessibilityLabel={t("library.addBookSongs")}
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
          accessibilityLabel={editMode ? t("library.doneEditing") : t("library.editBook")}
        >
          <Ionicons
            name={editMode ? "checkmark" : "pencil"}
            size={16}
            color={editMode ? colors.primaryDeep : colors.textStrong}
          />
        </Pressable>

        <View style={bookStyles.actionSpacer} />

        <Pressable
          style={({ pressed }) => [bookStyles.quietBtn, pressed ? styles.pressDown : null]}
          onPress={() => setMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t("library.songbookOptions")}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textStrong} />
        </Pressable>
      </View>

      {editMode ? (
        <Text style={bookStyles.editHint}>{t("library.reorderHint")}</Text>
      ) : null}
    </View>
  );

  return (
    <>
      <DraggableFlatList
        // The list must be given the screen's remaining height: without it the
        // wrapper grows to its content and a long list runs off the bottom
        // with nothing to scroll (founder, 2026-10-13).
        containerStyle={styles.flexFill}
        data={songs}
        keyExtractor={(song) => song.ideaId}
        onDragBegin={haptic.grab}
        onDragEnd={({ data }) => onReorderSongs(data.map((song) => song.ideaId))}
        contentContainerStyle={[styles.libraryScrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            compact
            icon="book-outline"
            title={t("library.bookEmpty")}
            body={t("library.bookEmptyBody")}
            actionLabel={t("library.addSongs")}
            onAction={onAddSongs}
          />
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
                  accessibilityLabel={t("library.removeBookSong", { title: song.title })}
                >
                  <Ionicons name="remove-circle-outline" size={19} color={colors.danger} />
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
                  accessibilityLabel={t("library.playTitle", { title: song.title })}
                >
                  {isNowPlaying ? (
                    <NowPlayingIndicator playing={isPlaying} color={colors.primary} size={12} />
                  ) : (
                    <Ionicons
                      name="play"
                      size={12}
                      color={song.playableClip ? colors.textStrong : colors.textMuted}
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
                  isReadable(song) ? t("library.openBookTitle", { title: song.title }) : t("library.unavailableTitle", { title: song.title })
                }
              >
                <UserText value={song.title}
                  style={[
                    bookStyles.rowTitle,
                    looksMachineNamed(song.title) ? bookStyles.rowTitleMachine : null,
                    isNowPlaying ? bookStyles.rowTitleActive : null,
                    !song.available ? bookStyles.rowTitleMissing : null,
                  ]}
                  numberOfLines={1}
                >
                  {song.title}
                </UserText>
                {!song.available ? (
                  <Text style={bookStyles.missingText}>{t("library.missing")}</Text>
                ) : song.hasLyricChart || song.hasChordChart ? (
                  <Text style={bookStyles.rowMeta}>
                    {[
                      ...(song.hasLyricChart ? [t("reading.lyrics")] : []),
                      ...(song.hasChordChart ? [t("reading.chart")] : []),
                    ].join(" · ")}
                  </Text>
                ) : null}
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
                  accessibilityLabel={t("library.reorderTitle", { title: song.title })}
                >
                  <Ionicons name="reorder-three" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : (
                <Ionicons name={dirIcon("chevron-forward")} size={14} color={colors.textMuted} />
              )}
            </View>
          );
        }}
      />

      <SelectionActionSheet
        visible={menuVisible}
        title={t("library.songbookOptions")}
        onClose={() => setMenuVisible(false)}
        actions={[
          {
            key: "rename",
            label: t("library.renameBook"),
            icon: "pencil-outline",
            onPress: onRename,
          },
          {
            key: "share",
            label: t("library.share"),
            icon: "share-outline",
            opens: true,
            onPress: () => setShareMenuVisible(true),
          },
          {
            key: "delete",
            label: t("library.deleteBook"),
            icon: "trash-outline",
            tone: "danger",
            onPress: onDelete,
          },
        ]}
      />
      <SelectionActionSheet
        visible={shareMenuVisible}
        title={t("library.shareTitle")}
        onClose={() => setShareMenuVisible(false)}
        onBack={() => setMenuVisible(true)}
        actions={[
          ...(onShareFile
            ? [{ key: "export", label: t("library.shareFile"), icon: "folder-open-outline" as const, onPress: onShareFile }]
            : []),
          ...(onGetLink
            ? [{ key: "songnook-send", label: t("library.getLink"), icon: "paper-plane-outline" as const, onPress: onGetLink }]
            : []),
          { key: "share-text", label: t("library.shareText"), icon: "document-text-outline", onPress: onShareText },
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
    fontFamily: "Lora_500Medium",
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
  linkChipRow: {
    marginTop: 12,
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
  // Secondary keys are bare ink glyphs (2026-10-18): no fill, no circle.
  // Active (editing, shuffle on) is terracotta ink.
  quietBtn: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  quietBtnActive: {},
  actionSpacer: {
    flex: 1,
  },
  editHint: {
    ...textTokens.caption,
    color: colors.textMuted,
    marginTop: 10,
  },
  // A song is your work: the card recipe (white, r12, borderless, whisper).
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 64,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    ...shadows.card,
  },
  songRowDragging: {
    opacity: 0.92,
  },
  rowPlay: {
    width: 28,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  rowPlayDisabled: {
    opacity: 0.45,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 17,
    color: colors.textPrimary,
  },
  rowTitleMachine: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  rowMeta: {
    ...textTokens.caption,
    color: colors.textSecondary,
  },
  rowTitleActive: {
    color: colors.primaryDeep,
  },
  rowTitleMissing: {
    color: colors.textMuted,
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
});
