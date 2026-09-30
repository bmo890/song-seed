import { ViewInCollectionButton } from "./common/ViewInCollectionButton";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { findClipInIdea, findIdeaInLibrary, findWorkspaceOfIdea, queueListingKey } from "../state/librarySelectors";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { FlatList } from "react-native-gesture-handler";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../design/tokens";
import { haptic } from "../design/haptics";
import { useStore } from "../state/useStore";
import { fmtDuration } from "../utils";
import { getClipPlaybackDurationMs } from "../domain/clipPresentation";
import {
  QUEUE_ROW_HEIGHT,
  buildQueueRowKeys,
  queueScrollTargetIndex,
  shouldFollowQueueIndex,
  visibleQueueRows,
} from "../domain/queueListing";
import { NowPlayingIndicator } from "./common/NowPlayingIndicator";
import type { PlaybackQueueItem } from "../types";
import { useTranslation } from "react-i18next";
import { UserText } from "../i18n";

type QueueRow = {
  key: string;
  queueItem: PlaybackQueueItem;
  index: number;
  ideaId: string | null;
  workspaceId: string | null;
  title: string;
  subtitle: string;
  durationMs: number | null;
};

/** What a row needs from the panel. Held in context (not closed over by the
 *  row template) so the list's row renderer stays one stable function and a
 *  panel re-render never re-runs every mounted row. */
type QueueRowActions = {
  editMode: boolean;
  /** The dock panel sits on paper (surfaceContainer); the sheet on a white
   *  card. The playing row lifts one tone off whichever it is on. */
  framed: boolean;
  jumpTo: (index: number) => void;
  removeAt: (index: number) => void;
  goToSong: (row: QueueRow) => void;
};

const QueueRowContext = createContext<QueueRowActions>({
  editMode: false,
  framed: true,
  jumpTo: () => {},
  removeAt: () => {},
  goToSong: () => {},
});

/**
 * One queue row. Subscribes to the store for its own "is this the playing
 * row" bit, so a track change re-renders exactly two rows: the one that
 * stopped being current and the one that became it.
 */
const QueueRowItem = memo(function QueueRowItem({
  row,
  drag,
  isActive,
}: {
  row: QueueRow;
  drag: () => void;
  isActive: boolean;
}) {
  const { t } = useTranslation();
  const { editMode, framed, jumpTo, removeAt, goToSong } = useContext(QueueRowContext);
  const isCurrent = useStore((s) => s.playerQueueIndex === row.index);
  const playing = useStore((s) => isCurrent && s.playerIsPlaying);

  return (
    <Pressable
      style={({ pressed }) => [
        panelStyles.row,
        isCurrent ? (framed ? panelStyles.rowCurrent : panelStyles.rowCurrentOnCard) : null,
        isActive ? panelStyles.rowDragging : null,
        pressed && !editMode ? { opacity: 0.75 } : null,
      ]}
      onPress={() => {
        if (editMode) return;
        jumpTo(row.index);
      }}
      disabled={editMode}
      accessibilityRole="button"
      accessibilityLabel={t("common.playItem", { title: row.title })}
    >
      {editMode ? (
        <Pressable
          style={({ pressed }) => [panelStyles.removeBtn, pressed ? { opacity: 0.6 } : null]}
          onPress={() => removeAt(row.index)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.removeFromQueue", { title: row.title })}
        >
          <Ionicons name="remove-circle-outline" size={19} color="#B4574A" />
        </Pressable>
      ) : (
        <View style={panelStyles.rowNum}>
          {isCurrent ? (
            <NowPlayingIndicator playing={playing} color={colors.primary} />
          ) : (
            <Text style={panelStyles.rowNumText}>{row.index + 1}</Text>
          )}
        </View>
      )}
      <View style={panelStyles.rowCopy}>
        <UserText
          style={[panelStyles.rowTitle, isCurrent ? panelStyles.rowTitleCurrent : null]}
          numberOfLines={1}
        >
          {row.title}
        </UserText>
        {row.subtitle && row.subtitle !== row.title ? (
          <UserText style={panelStyles.rowSubtitle} numberOfLines={1}>
            {row.subtitle}
          </UserText>
        ) : null}
      </View>
      {row.durationMs != null ? (
        <Text style={panelStyles.rowDuration}>{fmtDuration(row.durationMs)}</Text>
      ) : null}
      {editMode ? (
        <Pressable
          style={({ pressed }) => [panelStyles.trailingBtn, pressed ? { opacity: 0.6 } : null]}
          onLongPress={drag}
          delayLongPress={120}
          accessibilityRole="button"
          accessibilityLabel={t("common.reorderItem", { title: row.title })}
        >
          <Ionicons name="reorder-three" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : row.ideaId ? (
        <View style={panelStyles.trailingBtn}>
          <ViewInCollectionButton
            testID="queue-view-in-collection"
            onPress={() => goToSong(row)}
            accessibilityLabel={t("common.viewInCollection", { title: row.subtitle || row.title })}
          />
        </View>
      ) : null}
    </Pressable>
  );
});

const keyExtractor = (row: QueueRow) => row.key;
const getItemLayout = (_: ArrayLike<QueueRow> | null | undefined, index: number) => ({
  length: QUEUE_ROW_HEIGHT,
  offset: QUEUE_ROW_HEIGHT * index,
  index,
});
const renderQueueRow = ({ item, drag, isActive }: RenderItemParams<QueueRow>) => (
  <QueueRowItem row={item} drag={drag} isActive={isActive} />
);

/**
 * The playback queue as a panel that extends UP from the media dock (not a
 * modal sheet): it stays open while you skip around — the rehearsal flow — and
 * never blocks the transport controls beneath it. Tapping a row jumps playback
 * and keeps the panel open. Edit mode reveals drag-to-reorder + remove, exactly
 * like the playlist editor. Works identically for playlist and ad-hoc queues.
 *
 * Opens resting on the playing row (one row of history above it) and follows
 * the playing row when the track changes, unless the list was scrolled away.
 */
function QueuePanelInner({
  onOpenIdea,
  framed = true,
}: {
  /** Navigate to a song/clip's own page ("go to song") — the rehearsal jump from
   *  hearing a track to working on it. Provided by the host, which owns nav. */
  onOpenIdea: (ideaId: string) => void;
  /** framed = standalone panel chrome (dock): a six-row window above the
   *  transport. false = bare content that FILLS the host's container (the full
   *  player's bottom sheet, which the listener resizes). */
  framed?: boolean;
}) {
  const { t } = useTranslation();
  const playerQueue = useStore((s) => s.playerQueue);
  const playerQueueIndex = useStore((s) => s.playerQueueIndex);
  // Re-renders only when a listed title or length changes, not on every library write.
  const queueKey = useStore((s) => queueListingKey(s.workspaces, playerQueue));
  const [editMode, setEditMode] = useState(false);
  const listRef = useRef<FlatList<QueueRow>>(null);

  // Memoized with an id-index: the naive per-row workspace scan was O(queue × library)
  // and re-ran on EVERY render — noticeable once the library passed ~100 clips.
  // The playing index is NOT part of a row (each row reads it from the store), so
  // a track change hands the list the same row objects.
  const rows: QueueRow[] = useMemo(() => {
    const workspaces = useStore.getState().workspaces;
    const keys = buildQueueRowKeys(playerQueue);
    return playerQueue.map((item, index) => {
      const idea = findIdeaInLibrary(workspaces, item.ideaId);
      const workspaceId = findWorkspaceOfIdea(workspaces, item.ideaId)?.id ?? null;
      const clip = findClipInIdea(idea, item.clipId);
      return {
        // Value-keyed (not index-keyed) so a drag reorder doesn't reshuffle keys;
        // a repeated clip gets an occurrence suffix so keys never collide.
        key: keys[index],
        queueItem: item,
        index,
        ideaId: idea?.id ?? null,
        workspaceId,
        title: clip?.title || idea?.title || "Unknown clip",
        subtitle: idea?.title ?? "",
        durationMs: clip ? getClipPlaybackDurationMs(clip) ?? null : null,
      };
    });
    // queueKey fingerprints everything read from the library above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerQueue, queueKey]);

  const onOpenIdeaRef = useRef(onOpenIdea);
  onOpenIdeaRef.current = onOpenIdea;

  const jumpTo = useCallback((index: number) => {
    const state = useStore.getState();
    state.requestInlineStop();
    state.setPlayerQueue(state.playerQueue, index, true);
    haptic.tap();
  }, []);

  const goToSong = useCallback((row: QueueRow) => {
    if (!row.ideaId || !row.workspaceId) return;
    const state = useStore.getState();
    if (state.activeWorkspaceId !== row.workspaceId) {
      state.setActiveWorkspaceId(row.workspaceId);
    }
    state.setSelectedIdeaId(row.ideaId);
    onOpenIdeaRef.current(row.ideaId);
  }, []);

  const removeAt = useCallback((index: number) => {
    const before = useStore.getState().playerQueue.length;
    useStore.getState().removeFromPlayerQueue(index);
    haptic.light();
    // Removing the last item ends the session — collapse the full player if it's
    // open (the dock hides itself once the queue empties) and drop out of edit.
    if (before <= 1) {
      useStore.getState().requestPlayerClose();
      setEditMode(false);
    }
  }, []);

  const onDragEnd = useCallback(({ data }: { data: QueueRow[] }) => {
    useStore.getState().reorderPlayerQueue(data.map((r) => r.queueItem));
    haptic.tap();
  }, []);

  const rowActions = useMemo<QueueRowActions>(
    () => ({ editMode, framed, jumpTo, removeAt, goToSong }),
    [editMode, framed, jumpTo, removeAt, goToSong]
  );

  // ── Resting on the playing row ────────────────────────────────────────────
  // Fixed row height + getItemLayout: the list renders its first rows AT the
  // playing row. How the viewport gets there differs per platform:
  // - iOS: the list's own one-shot scroll (a JS round trip) lands before the
  //   sheet's first drawn frame, and its scroll event is what lets the list
  //   grow past its first ten rows. A native `contentOffset` there is applied
  //   before the view can emit events, so the list would freeze at ten rows.
  // - Android: the dialog draws as soon as it is shown, so the round trip
  //   shows the top of the list for a frame or two, then jumps. A native
  //   `contentOffset` is deferred until the content is laid out and emits a
  //   scroll event when it lands, so the first drawn frame is already right.
  const initialScrollIndex = useRef(queueScrollTargetIndex(playerQueueIndex, playerQueue.length)).current;
  const initialContentOffset = useRef(
    Platform.OS === "android" ? { x: 0, y: initialScrollIndex * QUEUE_ROW_HEIGHT } : undefined
  ).current;
  const scrollOffsetRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const onScrollOffsetChange = useCallback((offset: number) => {
    scrollOffsetRef.current = offset;
  }, []);
  const onContainerLayout = useCallback(({ layout }: { layout: { height: number } }) => {
    viewportHeightRef.current = layout.height;
  }, []);

  // Android safety net for the native offset: if the list has laid out and no
  // scroll has been reported after a few frames, the deferred offset never
  // landed — scroll there explicitly (which does emit the event).
  useEffect(() => {
    if (!initialContentOffset || initialContentOffset.y === 0) return;
    const timer = setTimeout(() => {
      if (scrollOffsetRef.current !== 0) return;
      listRef.current?.scrollToOffset({ offset: initialContentOffset.y, animated: false });
    }, 120);
    return () => clearTimeout(timer);
  }, [initialContentOffset]);

  // Follow the playing row on a track change only when it was on screen and the
  // new one is not: a list you scrolled elsewhere is left where you put it.
  const previousIndexRef = useRef(playerQueueIndex);
  useEffect(() => {
    const previousIndex = previousIndexRef.current;
    previousIndexRef.current = playerQueueIndex;
    const length = playerQueue.length;
    if (length === 0 || playerQueueIndex < 0 || playerQueueIndex >= length) return;
    const visible = visibleQueueRows(scrollOffsetRef.current, viewportHeightRef.current, length);
    if (!shouldFollowQueueIndex({ previousIndex, nextIndex: playerQueueIndex, visible })) return;
    listRef.current?.scrollToIndex({
      index: queueScrollTargetIndex(playerQueueIndex, length),
      animated: true,
    });
  }, [playerQueueIndex, playerQueue.length]);

  return (
    <View style={framed ? panelStyles.panel : panelStyles.fill}>
      <View style={panelStyles.headerRow}>
        <Text style={panelStyles.title}>{t("mediaDock.queue")}</Text>
        <View style={panelStyles.headerRight}>
          <Text style={panelStyles.counter}>
            {t("mediaDock.position", { current: Math.min(playerQueueIndex + 1, playerQueue.length), total: playerQueue.length })}
          </Text>
          {playerQueue.length > 0 ? (
            <Pressable
              style={({ pressed }) => [panelStyles.editBtn, pressed ? { opacity: 0.6 } : null]}
              onPress={() => {
                haptic.tap();
                setEditMode((value) => !value);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t(editMode ? "mediaDock.doneEditing" : "mediaDock.editQueue")}
            >
              <Text style={[panelStyles.editBtnText, editMode ? panelStyles.editBtnTextActive : null]}>
                {t(editMode ? "mediaDock.done" : "mediaDock.edit")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <QueueRowContext.Provider value={rowActions}>
        <DraggableFlatList
          ref={listRef}
          data={rows}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          initialScrollIndex={initialScrollIndex}
          contentOffset={initialContentOffset}
          containerStyle={framed ? undefined : panelStyles.fill}
          style={framed ? panelStyles.list : panelStyles.fill}
          contentContainerStyle={panelStyles.listContent}
          showsVerticalScrollIndicator={false}
          activationDistance={14}
          onDragBegin={haptic.grab}
          onDragEnd={onDragEnd}
          onScrollOffsetChange={onScrollOffsetChange}
          onContainerLayout={onContainerLayout}
          renderItem={renderQueueRow}
        />
      </QueueRowContext.Provider>
    </View>
  );
}

// Memoized: hosts re-render on playback ticks; the panel's own store subscriptions
// (queue, index) are what should drive its updates — with stable props, host
// renders no longer cascade into the row list at playback cadence.
export const QueuePanel = memo(QueuePanelInner);

const panelStyles = StyleSheet.create({
  // Sits directly above the dock surface inside the same bottom-anchored wrap, so
  // it visually extends the dock upward. Stays light/paper, but a STRONG terracotta
  // border on the top + sides (never the bottom — it meets the dock there) ties it
  // to the terracotta control bar and frames it as one unit against the paper page.
  panel: {
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderColor: "#8b4f3b",
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingBottom: spacing.xs,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.md,
  },
  title: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 17,
    color: colors.textPrimary,
  },
  counter: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  editBtn: {
    paddingVertical: 2,
  },
  editBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  editBtnTextActive: {
    color: colors.primary,
  },
  list: {
    maxHeight: QUEUE_ROW_HEIGHT * 6,
  },
  // Sheet host: the panel and its list fill whatever height the sheet is at.
  fill: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 6,
  },
  // One fixed height in both modes: the row's controls swap without the row
  // (or anything beneath it) moving.
  row: {
    height: QUEUE_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
  },
  rowCurrent: {
    backgroundColor: colors.surface,
  },
  // On the sheet's white card `surface` would vanish: wash down a tone instead.
  rowCurrentOnCard: {
    backgroundColor: colors.surfaceContainer,
  },
  rowDragging: {
    backgroundColor: colors.surfaceHigh,
  },
  rowNum: {
    width: 22,
    alignItems: "center",
  },
  rowNumText: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  removeBtn: {
    width: 22,
    alignItems: "center",
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowTitle: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowTitleCurrent: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
  rowSubtitle: {
    ...textTokens.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  rowDuration: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  // Shared box for the trailing control (view-in-collection glyph or the drag
  // handle) so the two modes lay out identically.
  trailingBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});
