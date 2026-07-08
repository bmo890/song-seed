import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../design/tokens";
import { haptic } from "../design/haptics";
import { useStore } from "../state/useStore";
import { fmtDuration } from "../utils";
import { getClipPlaybackDurationMs } from "../clipPresentation";
import { NowPlayingIndicator } from "./common/NowPlayingIndicator";
import type { PlaybackQueueItem } from "../types";

type QueueRow = {
  key: string;
  queueItem: PlaybackQueueItem;
  index: number;
  ideaId: string | null;
  workspaceId: string | null;
  title: string;
  subtitle: string;
  durationMs: number | null;
  isCurrent: boolean;
};

/**
 * The playback queue as a panel that extends UP from the media dock (not a
 * modal sheet): it stays open while you skip around — the rehearsal flow — and
 * never blocks the transport controls beneath it. Tapping a row jumps playback
 * and keeps the panel open. Edit mode reveals drag-to-reorder + remove, exactly
 * like the playlist editor. Works identically for playlist and ad-hoc queues.
 */
export function QueuePanel({
  onOpenIdea,
  framed = true,
}: {
  /** Navigate to a song/clip's own page ("go to song") — the rehearsal jump from
   *  hearing a track to working on it. Provided by the host, which owns nav. */
  onOpenIdea: (ideaId: string) => void;
  /** framed = standalone panel chrome (dock). false = bare content for hosts
   *  that provide their own container (the full player's bottom sheet). */
  framed?: boolean;
}) {
  const playerQueue = useStore((s) => s.playerQueue);
  const playerQueueIndex = useStore((s) => s.playerQueueIndex);
  const playerIsPlaying = useStore((s) => s.playerIsPlaying);
  const workspaces = useStore((s) => s.workspaces);
  const [editMode, setEditMode] = useState(false);

  const rows: QueueRow[] = playerQueue.map((item, index) => {
    const workspace = workspaces.find((ws) => ws.ideas.some((candidate) => candidate.id === item.ideaId));
    const idea = workspace?.ideas.find((candidate) => candidate.id === item.ideaId);
    const clip = idea?.clips.find((candidate) => candidate.id === item.clipId);
    return {
      // Value-keyed (not index-keyed) so a drag reorder doesn't reshuffle keys.
      key: `${item.ideaId}:${item.clipId}`,
      queueItem: item,
      index,
      ideaId: idea?.id ?? null,
      workspaceId: workspace?.id ?? null,
      title: clip?.title || idea?.title || "Unknown clip",
      subtitle: idea?.title ?? "",
      durationMs: clip ? getClipPlaybackDurationMs(clip) ?? null : null,
      isCurrent: index === playerQueueIndex,
    };
  });

  const jumpTo = (index: number) => {
    const state = useStore.getState();
    state.requestInlineStop();
    state.setPlayerQueue(state.playerQueue, index, true);
    haptic.tap();
  };

  const goToSong = (row: QueueRow) => {
    if (!row.ideaId || !row.workspaceId) return;
    const state = useStore.getState();
    if (state.activeWorkspaceId !== row.workspaceId) {
      state.setActiveWorkspaceId(row.workspaceId);
    }
    state.setSelectedIdeaId(row.ideaId);
    haptic.tap();
    onOpenIdea(row.ideaId);
  };

  const removeAt = (index: number) => {
    const before = useStore.getState().playerQueue.length;
    useStore.getState().removeFromPlayerQueue(index);
    haptic.light();
    // Removing the last item ends the session — collapse the full player if it's
    // open (the dock hides itself once the queue empties) and drop out of edit.
    if (before <= 1) {
      useStore.getState().requestPlayerClose();
      setEditMode(false);
    }
  };

  const onReorder = (data: QueueRow[]) => {
    useStore.getState().reorderPlayerQueue(data.map((r) => r.queueItem));
    haptic.tap();
  };

  return (
    <View style={framed ? panelStyles.panel : null}>
      <View style={panelStyles.headerRow}>
        <Text style={panelStyles.title}>Queue</Text>
        <View style={panelStyles.headerRight}>
          <Text style={panelStyles.counter}>
            {Math.min(playerQueueIndex + 1, playerQueue.length)} of {playerQueue.length}
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
              accessibilityLabel={editMode ? "Done editing queue" : "Edit queue"}
            >
              <Text style={[panelStyles.editBtnText, editMode ? panelStyles.editBtnTextActive : null]}>
                {editMode ? "Done" : "Edit"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <DraggableFlatList
        data={rows}
        keyExtractor={(row) => row.key}
        style={panelStyles.list}
        contentContainerStyle={panelStyles.listContent}
        showsVerticalScrollIndicator={false}
        activationDistance={14}
        onDragBegin={haptic.grab}
        onDragEnd={({ data }) => onReorder(data)}
        renderItem={({ item: row, drag, isActive }) => (
          <Pressable
            style={({ pressed }) => [
              panelStyles.row,
              row.isCurrent ? panelStyles.rowCurrent : null,
              isActive ? panelStyles.rowDragging : null,
              pressed && !editMode ? { opacity: 0.75 } : null,
            ]}
            onPress={() => {
              if (editMode) return;
              jumpTo(row.index);
            }}
            disabled={editMode}
            accessibilityRole="button"
            accessibilityLabel={`Play ${row.title}`}
          >
            {editMode ? (
              <Pressable
                style={({ pressed }) => [panelStyles.removeBtn, pressed ? { opacity: 0.6 } : null]}
                onPress={() => removeAt(row.index)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${row.title} from queue`}
              >
                <Ionicons name="remove-circle-outline" size={19} color="#B4574A" />
              </Pressable>
            ) : (
              <View style={panelStyles.rowNum}>
                {row.isCurrent ? (
                  <NowPlayingIndicator playing={playerIsPlaying} color={colors.primary} />
                ) : (
                  <Text style={panelStyles.rowNumText}>{row.index + 1}</Text>
                )}
              </View>
            )}
            <View style={panelStyles.rowCopy}>
              <Text
                style={[panelStyles.rowTitle, row.isCurrent ? panelStyles.rowTitleCurrent : null]}
                numberOfLines={1}
              >
                {row.title}
              </Text>
              {row.subtitle && row.subtitle !== row.title ? (
                <Text style={panelStyles.rowSubtitle} numberOfLines={1}>
                  {row.subtitle}
                </Text>
              ) : null}
            </View>
            {row.durationMs != null ? (
              <Text style={panelStyles.rowDuration}>{fmtDuration(row.durationMs)}</Text>
            ) : null}
            {editMode ? (
              <Pressable
                style={({ pressed }) => [panelStyles.dragHandle, pressed ? { opacity: 0.6 } : null]}
                onLongPress={drag}
                delayLongPress={120}
                accessibilityRole="button"
                accessibilityLabel={`Reorder ${row.title}`}
              >
                <Ionicons name="reorder-three" size={18} color={colors.textSecondary} />
              </Pressable>
            ) : row.ideaId ? (
              <Pressable
                style={({ pressed }) => [panelStyles.goToBtn, pressed ? { opacity: 0.6 } : null]}
                onPress={(evt) => {
                  evt.stopPropagation();
                  goToSong(row);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${row.subtitle || row.title}`}
              >
                <Ionicons name="open-outline" size={15} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

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
    fontFamily: "PlayfairDisplay_600SemiBold",
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
    maxHeight: 264,
  },
  listContent: {
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
  },
  rowCurrent: {
    backgroundColor: colors.surface,
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
  goToBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandle: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});
