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
import { colors, radii, spacing, text as textTokens, shadows } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { fmtDuration } from "../../../utils";
import type { Setlist } from "../../../types";
import type { ResolvedSetlistEntry } from "../../../domain/setlistPlayback";
import { useTranslation } from "react-i18next";
import { looksMachineNamed } from "../../../domain/titleNaming";
import { UserText } from "../../../i18n";

type SetlistDetailViewProps = {
  setlist: Setlist;
  entries: ResolvedSetlistEntry[];
  setDurationMs: number | null;
  nowPlayingEntryId: string | null;
  isPlaying: boolean;
  onPlayAll: () => void;
  onPlayEntry: (entryId: string) => void;
  onOpenEntry: (entryId: string) => void;
  onEditEntry: (entryId: string) => void;
  onAddSong: () => void;
  onReorder: (orderedEntryIds: string[]) => void;
  onRemoveEntry: (entryId: string) => void;
  onRename: () => void;
  onShare: () => void;
  onGetLink?: () => void;
  onDelete: () => void;
};

/** The rehearsal folder — every row is a packaged song. Tapping opens its
 *  folder; the lead button plays it straight into the dock. Editing (reorder /
 *  repack / remove) is an explicit mode, never an accidental tap. */
export function SetlistDetailView({
  setlist,
  entries,
  setDurationMs,
  nowPlayingEntryId,
  isPlaying,
  onPlayAll,
  onPlayEntry,
  onOpenEntry,
  onEditEntry,
  onAddSong,
  onReorder,
  onRemoveEntry,
  onRename,
  onShare,
  onGetLink,
  onDelete,
}: SetlistDetailViewProps) {
  const { t } = useTranslation();
  const [editMode, setEditMode] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  // Share… drills into a second sheet: a file, or SongNook Send.
  const [shareMenuVisible, setShareMenuVisible] = useState(false);

  const playableCount = entries.filter((entry) => entry.available).length;
  const metaParts = [
    t("library.songs", { count: entries.length }),
    ...(setDurationMs != null ? [fmtDuration(setDurationMs)] : []),
  ];

  const header = (
    <View style={setStyles.header}>
      <Text style={setStyles.eyebrow}>{t("library.setlists")}</Text>
      <UserText value={setlist.title} style={setStyles.title} numberOfLines={2}>
        {setlist.title}
      </UserText>
      <Text style={setStyles.meta}>{metaParts.join("  ·  ")}</Text>
      {setlist.description ? (
        <UserText value={setlist.description} style={setStyles.description} numberOfLines={3}>
          {setlist.description}
        </UserText>
      ) : null}

      <View style={setStyles.linkChipRow}>
        <SentLinkChip entityId={setlist.id} />
      </View>

      <View style={setStyles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            setStyles.playBtn,
            playableCount === 0 ? setStyles.playBtnDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => {
            haptic.tap();
            onPlayAll();
          }}
          disabled={playableCount === 0}
          accessibilityRole="button"
          accessibilityLabel={t("library.playSet")}
        >
          <Ionicons name="play" size={22} color={colors.onPrimary} style={{ marginLeft: 3 }} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [setStyles.quietBtn, pressed ? styles.pressDown : null]}
          onPress={onAddSong}
          accessibilityRole="button"
          accessibilityLabel={t("library.addSetSong")}
        >
          <Ionicons name="add" size={19} color={colors.textStrong} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            setStyles.quietBtn,
            editMode ? setStyles.quietBtnActive : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => setEditMode((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={editMode ? t("library.doneEditing") : t("library.editSet")}
        >
          <Ionicons
            name={editMode ? "checkmark" : "pencil"}
            size={16}
            color={editMode ? colors.primaryDeep : colors.textStrong}
          />
        </Pressable>

        <View style={setStyles.actionSpacer} />

        <Pressable
          style={({ pressed }) => [setStyles.quietBtn, pressed ? styles.pressDown : null]}
          onPress={() => setMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t("library.setlistOptions")}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textStrong} />
        </Pressable>
      </View>

      {editMode ? (
        <Text style={setStyles.editHint}>{t("library.setEditHint")}</Text>
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
        data={entries}
        keyExtractor={(entry) => entry.entryId}
        onDragBegin={haptic.grab}
        onDragEnd={({ data }) => onReorder(data.map((entry) => entry.entryId))}
        contentContainerStyle={[styles.libraryScrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            compact
            icon="albums-outline"
            title={t("library.setEmpty")}
            body={t("library.setEmptyBody")}
            actionLabel={t("library.addSongShort")}
            onAction={onAddSong}
          />
        }
        renderItem={({ item: entry, drag, isActive, getIndex }: RenderItemParams<ResolvedSetlistEntry>) => {
          const isNowPlaying = entry.entryId === nowPlayingEntryId;
          const index = (getIndex() ?? 0) + 1;
          const partCount = entry.parts.length;
          const entryMeta = [
            ...(partCount > 1 ? [t("library.parts", { count: partCount })] : []),
            ...(entry.lyricVersionIds.length > 0 ? [t("reading.lyrics")] : []),
            ...(entry.hasChordChart ? [t("reading.chart")] : []),
            ...(entry.includeSongNotes && entry.songNotes ? [t("songDetail.notes")] : []),
          ].join(" · ");

          return (
            <View
              style={[
                setStyles.entryRow,
                isNowPlaying ? setStyles.entryRowActive : null,
                isActive ? setStyles.entryRowDragging : null,
              ]}
            >
              {editMode ? (
                <Pressable
                  style={({ pressed }) => [setStyles.removeBtn, pressed ? styles.pressDown : null]}
                  onPress={() => onRemoveEntry(entry.entryId)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t("library.removeSetSong", { title: entry.title })}
                >
                  <Ionicons name="remove-circle-outline" size={19} color={colors.danger} />
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    setStyles.leadBtn,
                    pressed && entry.available ? styles.pressDown : null,
                  ]}
                  onPress={() => {
                    if (!entry.available) return;
                    haptic.tap();
                    onPlayEntry(entry.entryId);
                  }}
                  disabled={!entry.available}
                  accessibilityRole="button"
                  accessibilityLabel={t("library.playTitle", { title: entry.title })}
                >
                  {isNowPlaying ? (
                    <NowPlayingIndicator playing={isPlaying} color={colors.primary} size={12} />
                  ) : (
                    <Text style={setStyles.entryNum}>{index}</Text>
                  )}
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  setStyles.entryMain,
                  pressed && !editMode ? styles.pressDown : null,
                ]}
                onPress={() => {
                  haptic.tap();
                  if (editMode) {
                    onEditEntry(entry.entryId);
                    return;
                  }
                  onOpenEntry(entry.entryId);
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  editMode ? t("library.repackTitle", { title: entry.title }) : t("library.openFolder", { title: entry.title })
                }
              >
                <UserText value={entry.title}
                  style={[
                    setStyles.entryTitle,
                    looksMachineNamed(entry.title) ? setStyles.entryTitleMachine : null,
                    isNowPlaying ? setStyles.entryTitleActive : null,
                    !entry.available ? setStyles.entryTitleMissing : null,
                  ]}
                  numberOfLines={1}
                >
                  {entry.title}
                </UserText>
                {!entry.available ? (
                  <Text style={setStyles.missingText}>{t("library.missing")}</Text>
                ) : entryMeta ? (
                  <Text style={setStyles.entryMeta} numberOfLines={1}>
                    {entryMeta}
                  </Text>
                ) : null}
              </Pressable>

              {entry.durationMs != null && entry.available && !editMode ? (
                <Text style={[setStyles.entryDuration, isNowPlaying ? setStyles.entryDurationActive : null]}>
                  {fmtDuration(entry.durationMs)}
                </Text>
              ) : null}

              {editMode ? (
                <Pressable
                  style={({ pressed }) => [setStyles.dragHandle, pressed ? styles.pressDown : null]}
                  onLongPress={drag}
                  delayLongPress={120}
                  accessibilityRole="button"
                  accessibilityLabel={t("library.reorderTitle", { title: entry.title })}
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
        title={t("library.setlistOptions")}
        onClose={() => setMenuVisible(false)}
        actions={[
          {
            key: "details",
            label: t("library.setDetails"),
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
            label: t("library.deleteSet"),
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
          { key: "export", label: t("library.shareFile"), icon: "folder-open-outline", onPress: onShare },
          ...(onGetLink
            ? [{ key: "songnook-send", label: t("library.getLink"), icon: "paper-plane-outline" as const, onPress: onGetLink }]
            : []),
        ]}
      />
    </>
  );
}

const setStyles = StyleSheet.create({
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
  description: {
    ...textTokens.body,
    color: colors.textSecondary,
    marginTop: 10,
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
  // A song in the set is your work: the card recipe (white, r12, borderless,
  // whisper). The one sounding is told by its title in terracotta ink.
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    ...shadows.card,
  },
  entryRowActive: {},
  entryRowDragging: {
    opacity: 0.92,
  },
  leadBtn: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  entryNum: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  entryMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  entryTitle: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 17,
    color: colors.textPrimary,
  },
  entryTitleMachine: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  entryMeta: {
    ...textTokens.caption,
    color: colors.textSecondary,
  },
  entryTitleActive: {
    color: colors.primaryDeep,
  },
  entryTitleMissing: {
    color: colors.textMuted,
  },
  missingText: {
    ...textTokens.caption,
    color: colors.textMuted,
  },
  entryDuration: {
    ...textTokens.caption,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  entryDurationActive: {
    color: colors.primaryDeep,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  removeBtn: {
    width: 26,
    alignItems: "center",
  },
  dragHandle: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
});
