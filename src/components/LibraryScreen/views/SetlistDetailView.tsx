import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SentLinkChip } from "../../common/SentLinkChip";
import { NowPlayingIndicator } from "../../common/NowPlayingIndicator";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { fmtDuration } from "../../../utils";
import type { Setlist } from "../../../types";
import type { ResolvedSetlistEntry } from "../../../domain/setlistPlayback";
import { useTranslation } from "react-i18next";
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
            color={editMode ? colors.onPrimary : colors.textStrong}
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
        data={entries}
        keyExtractor={(entry) => entry.entryId}
        onDragBegin={haptic.grab}
        onDragEnd={({ data }) => onReorder(data.map((entry) => entry.entryId))}
        contentContainerStyle={[styles.libraryScrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={setStyles.emptyWrap}>
            <Ionicons name="albums-outline" size={26} color={colors.textMuted} />
            <Text style={setStyles.emptyTitle}>{t("library.setEmpty")}</Text>
            <Text style={setStyles.emptyBody}>{t("library.setEmptyBody")}</Text>
            <Pressable
              style={({ pressed }) => [setStyles.emptyAddBtn, pressed ? styles.pressDown : null]}
              onPress={onAddSong}
            >
              <Ionicons name="add" size={15} color={colors.onPrimary} />
              <Text style={setStyles.emptyAddLabel}>{t("library.addSongShort")}</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: entry, drag, isActive, getIndex }: RenderItemParams<ResolvedSetlistEntry>) => {
          const isNowPlaying = entry.entryId === nowPlayingEntryId;
          const index = (getIndex() ?? 0) + 1;
          const partCount = entry.parts.length;

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
                  <Ionicons name="remove-circle-outline" size={19} color="#B4574A" />
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
                    isNowPlaying ? setStyles.entryTitleActive : null,
                    !entry.available ? setStyles.entryTitleMissing : null,
                  ]}
                  numberOfLines={1}
                >
                  {entry.title}
                </UserText>
                <View style={setStyles.chipRow}>
                  {entry.available ? (
                    <>
                      {partCount > 1 ? (
                        <Text style={setStyles.partCount}>
                          {t("library.parts", { count: partCount })}
                        </Text>
                      ) : null}
                      {entry.lyricVersionIds.length > 0 ? (
                        <Text style={setStyles.chartChip}>{t("common.lyrics")}</Text>
                      ) : null}
                      {entry.hasChordChart ? <Text style={setStyles.chartChip}>{t("common.chords")}</Text> : null}
                      {entry.includeSongNotes && entry.songNotes ? (
                        <Text style={setStyles.chartChip}>{t("songDetail.notes")}</Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={setStyles.missingText}>{t("library.missing")}</Text>
                  )}
                </View>
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
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
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
            key: "rename",
            label: t("library.renameSet"),
            icon: "pencil-outline",
            onPress: onRename,
          },
          {
            key: "share",
            label: t("library.shareSet"),
            icon: "share-outline",
            onPress: onShare,
          },
          ...(onGetLink
            ? [
                {
                  key: "get-link",
                  label: t("library.getLink"),
                  icon: "link-outline" as const,
                  onPress: onGetLink,
                },
              ]
            : []),
          {
            key: "delete",
            label: t("library.deleteSet"),
            icon: "trash-outline",
            tone: "danger",
            onPress: onDelete,
          },
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
  entryRow: {
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
  entryRowActive: {
    backgroundColor: "#FDF5F2",
    borderColor: "#EBD3CE",
  },
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
    gap: 5,
  },
  entryTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  entryTitleActive: {
    color: colors.primaryDeep,
  },
  entryTitleMissing: {
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  chartChip: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 8.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.primaryDeep,
    backgroundColor: "#FDF5F2",
    borderWidth: 1,
    borderColor: "#EBD3CE",
    borderRadius: 4,
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  partCount: {
    ...textTokens.caption,
    fontSize: 10,
    color: colors.textSecondary,
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
