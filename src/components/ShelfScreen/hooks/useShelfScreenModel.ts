import { useEffect, useMemo, useRef } from "react";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { useShelfStore } from "../../../state/useShelfStore";
import { useMiniPlayerContext } from "../../../hooks/FullPlayerProvider";
import { getPlayableClipForIdea } from "../../../domain/clipPresentation";
import {
  isEntryExpired,
  isEntryInDecisionWindow,
  sweepExpiredEntries,
  type ShelfDeparture,
  type ShelfEntry,
} from "../../../domain/shelf";
import { openCollectionFromContext } from "../../../navigation";
import { toast } from "../../common/toastStore";
import { haptic } from "../../../design/haptics";
import type { ClipVersion, SongIdea } from "../../../types";

export type ShelfRow = {
  entry: ShelfEntry;
  idea: SongIdea;
  workspaceId: string;
  /** Where the item lives — its collection's title (workspace title as fallback). */
  sourceLabel: string;
  playableClip: ClipVersion | null;
  durationMs: number;
};

export type ShelfDepartedRowData = {
  departure: ShelfDeparture;
  idea: SongIdea;
};

export function useShelfScreenModel() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const rootNavigation = navigation.getParent?.();
  const navigateRoot = (routeName: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(routeName as never, params as never);

  const workspaces = useStore((state) => state.workspaces);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useStore((state) => state.setActiveWorkspaceId);
  const setSelectedIdeaId = useStore((state) => state.setSelectedIdeaId);
  const inlinePlayer = useMiniPlayerContext();
  const resetInlineRef = useRef(inlinePlayer.resetInlinePlayer);
  const inlineTarget = useStore((state) => state.inlineTarget);
  const isInlinePlaying = useStore((state) => state.inlineIsPlaying);

  const storeEntries = useShelfStore((state) => state.entries);
  const storeDeparted = useShelfStore((state) => state.departed);

  // First-frame rule: the VIEW derives the swept state in render, so an entry
  // that expired while the app was away presents as "recently left" on the very
  // first paint — never as a decision card that jumps sections a frame later.
  // `now` is plain Date.now(): focus flips re-render (useIsFocused), keeping
  // countdowns fresh. When nothing expired, sweepExpiredEntries returns the
  // store's own array refs, so downstream memos stay stable.
  const now = Date.now();
  const sweptView = sweepExpiredEntries(storeEntries, storeDeparted, now);
  const entries = sweptView.entries;
  const departed = sweptView.departed;

  // The effect merely COMMITS the sweep the render already displayed.
  useEffect(() => {
    if (!isFocused) return;
    useShelfStore.getState().sweep(Date.now());
  }, [isFocused, storeEntries]);

  useEffect(() => {
    resetInlineRef.current = inlinePlayer.resetInlinePlayer;
  }, [inlinePlayer.resetInlinePlayer]);

  useEffect(() => {
    if (isFocused) return;
    void resetInlineRef.current();
  }, [isFocused]);

  const findIdea = (ideaId: string): { idea: SongIdea; workspaceId: string } | null => {
    for (const workspace of workspaces) {
      const idea = workspace.ideas.find((candidate) => candidate.id === ideaId);
      if (idea) return { idea, workspaceId: workspace.id };
    }
    return null;
  };

  // Entries whose item was deleted from the library resolve to nothing and are
  // simply not shown; they age out of the store via the normal expiry sweep.
  const rows = useMemo<ShelfRow[]>(() => {
    const resolved: ShelfRow[] = [];
    for (const entry of entries) {
      const match = findIdea(entry.id);
      if (!match) continue;
      const workspace = workspaces.find((candidate) => candidate.id === match.workspaceId)!;
      const collection = match.idea.collectionId
        ? workspace.collections.find((candidate) => candidate.id === match.idea.collectionId)
        : null;
      const playableClip = getPlayableClipForIdea(match.idea);
      resolved.push({
        entry,
        idea: match.idea,
        workspaceId: match.workspaceId,
        sourceLabel: collection?.title ?? workspace.title,
        playableClip,
        durationMs: playableClip?.durationMs ?? 0,
      });
    }
    return resolved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, workspaces]);

  // Plain derivations — `now` is fresh each render, so memoizing on it is moot.
  // (Expired entries were already swept out of `rows` above; the isEntryExpired
  // check is a same-frame safety net.)
  const decidingRows = rows.filter(
    (row) => isEntryInDecisionWindow(row.entry, now) || isEntryExpired(row.entry, now)
  );
  const restingRows = rows.filter((row) => !decidingRows.includes(row));

  const departedRows = useMemo<ShelfDepartedRowData[]>(() => {
    const resolved: ShelfDepartedRowData[] = [];
    for (const departure of departed) {
      const match = findIdea(departure.id);
      if (!match) continue;
      resolved.push({ departure, idea: match.idea });
    }
    return resolved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departed, workspaces]);

  function syncWorkspaceContext(row: ShelfRow) {
    if (activeWorkspaceId !== row.workspaceId) {
      setActiveWorkspaceId(row.workspaceId);
    }
  }

  // Mirrors Revisit's card tap: a raw clip opens the full Player to listen; a
  // project opens its song page. The unplayable-clip guard comes FIRST so a
  // dead tap has no side effects (no silent workspace switch).
  function openRow(row: ShelfRow) {
    if (row.idea.kind === "clip" && !row.playableClip) return;
    void inlinePlayer.resetInlinePlayer();
    syncWorkspaceContext(row);
    if (row.idea.kind === "clip") {
      useStore
        .getState()
        .setPlayerQueueForScreen([{ ideaId: row.idea.id, clipId: row.playableClip!.id }], 0);
      return;
    }
    setSelectedIdeaId(row.idea.id);
    navigateRoot("IdeaDetail", { ideaId: row.idea.id });
  }

  // Contextual jump, like Revisit/Activity: back from the collection returns
  // HERE (backLabel names the origin), with the target card flash-highlighted.
  function viewRowInCollection(row: ShelfRow) {
    void inlinePlayer.resetInlinePlayer();
    syncWorkspaceContext(row);
    if (row.idea.collectionId) {
      openCollectionFromContext(navigation, {
        collectionId: row.idea.collectionId,
        workspaceId: row.workspaceId,
        focusIdeaId: row.idea.id,
        focusToken: Date.now(),
        source: "detail",
        backLabel: "Shelf",
      });
      return;
    }
    setSelectedIdeaId(row.idea.id);
    navigateRoot("IdeaDetail", { ideaId: row.idea.id });
  }

  function keepRowLonger(row: ShelfRow) {
    useShelfStore.getState().keepLonger(row.entry.key);
    haptic.light();
    toast("Kept for 7 more days", "checkmark-outline");
  }

  function letRowLeave(row: ShelfRow) {
    useShelfStore.getState().leaveShelf(row.entry.key);
    haptic.light();
    toast("Left the shelf — still in its collection", "checkmark-outline");
  }

  function reshelveDeparted(rowData: ShelfDepartedRowData) {
    useShelfStore.getState().reshelve(rowData.departure.key);
    haptic.light();
    toast("Back on the shelf for 7 days", "checkmark-outline");
  }

  function isRowActive(row: ShelfRow) {
    return (
      !!row.playableClip &&
      inlineTarget?.ideaId === row.idea.id &&
      inlineTarget.clipId === row.playableClip.id
    );
  }

  function isRowPlaying(row: ShelfRow) {
    return isRowActive(row) && isInlinePlaying;
  }

  function toggleRowPlay(row: ShelfRow) {
    if (!row.playableClip) return;
    void inlinePlayer.toggleInlinePlayback(row.idea.id, row.playableClip);
  }

  return {
    now,
    decidingRows,
    restingRows,
    departedRows,
    openRow,
    viewRowInCollection,
    keepRowLonger,
    letRowLeave,
    reshelveDeparted,
    isRowActive,
    isRowPlaying,
    toggleRowPlay,
    stopRowPlay: () => {
      void inlinePlayer.resetInlinePlayer();
    },
    onSeekInlineStart: () => {
      void inlinePlayer.beginInlineScrub();
    },
    onSeekInline: (ms: number) => {
      void inlinePlayer.endInlineScrub(ms);
    },
    onSeekInlineCancel: () => {
      void inlinePlayer.cancelInlineScrub();
    },
  };
}
