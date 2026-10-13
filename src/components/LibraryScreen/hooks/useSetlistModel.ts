import { useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { createSetlistShareLink, shareSetlist } from "../../../services/setlistShare";
import { openSendSheet } from "../../../state/useSendSheetStore";
import {
  buildSetlistQueue,
  getSetlistDurationMs,
  resolveSetlistEntries,
  type ResolvedSetlistEntry,
} from "../../../domain/setlistPlayback";
import type { SongIdea, Workspace } from "../../../types";
import { useTranslation } from "react-i18next";

type BuilderState = {
  setlistId: string;
  workspaceId: string | null;
  ideaId: string | null;
  editingEntryId: string | null;
  clipIds: string[];
  lyricVersionIds: string[];
  includeChordSheet: boolean;
  includeSongNotes: boolean;
};

function findIdea(workspaces: Workspace[], ideaId: string): { workspace: Workspace; idea: SongIdea } | null {
  for (const workspace of workspaces) {
    const idea = workspace.ideas.find((candidate) => candidate.id === ideaId);
    if (idea) return { workspace, idea };
  }
  return null;
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function useSetlistModel() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const rootNavigation = navigation.getParent?.();
  const navigateRoot = (route: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(route as never, params as never);

  const workspaces = useStore((s) => s.workspaces);
  const setlists = useStore((s) => s.setlists);
  const addSetlist = useStore((s) => s.addSetlist);
  const updateSetlistEntry = useStore((s) => s.updateSetlistEntry);
  const removeSetlistEntry = useStore((s) => s.removeSetlistEntry);
  const reorderSetlistEntries = useStore((s) => s.reorderSetlistEntries);
  const renameSetlist = useStore((s) => s.renameSetlist);
  const deleteSetlist = useStore((s) => s.deleteSetlist);
  const playerTarget = useStore((s) => s.playerTarget);
  const isPlayerPlaying = useStore((s) => s.playerIsPlaying);

  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(null);
  // The builder only ever REPACKS an entry already in the set (edit mode → tap a
  // row). Adding a song is the shared picker, same as a playlist's (2026-10-11).
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  const sortedSetlists = useMemo(
    () => setlists.slice().sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title)),
    [setlists]
  );

  const activeSetlistId = builder?.setlistId ?? selectedSetlistId;
  const activeSetlist = setlists.find((sl) => sl.id === activeSetlistId) ?? null;

  // Collector-return / import deep-link: open the named setlist.
  const route = useRoute<any>();
  const openCollectionKind = route.params?.openCollectionKind as string | undefined;
  const openCollectionId = route.params?.openCollectionId as string | undefined;
  const openToken = route.params?.openToken as number | undefined;
  useEffect(() => {
    if (openCollectionKind !== "setlist" || !openCollectionId || !openToken) return;
    setSelectedSetlistId(openCollectionId);
    setBuilder(null);
    (navigation as any).setParams({
      openCollectionKind: undefined,
      openCollectionId: undefined,
      openToken: undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCollectionKind, openCollectionId, openToken]);

  // Each entry resolved as a packaged song folder against the live library.
  const resolvedEntries = useMemo<ResolvedSetlistEntry[]>(
    () => (activeSetlist ? resolveSetlistEntries(workspaces, activeSetlist) : []),
    [activeSetlist, workspaces]
  );

  const setDurationMs = useMemo(() => getSetlistDurationMs(resolvedEntries), [resolvedEntries]);

  // Which entry holds the clip currently loaded in the dock/player.
  const nowPlayingEntryId = useMemo(() => {
    if (!playerTarget) return null;
    for (const entry of resolvedEntries) {
      if (entry.parts.some((part) => part.clipId === playerTarget.clipId && entry.idea?.id === playerTarget.ideaId)) {
        return entry.entryId;
      }
    }
    return null;
  }, [playerTarget, resolvedEntries]);

  function playFromEntry(entryId?: string) {
    const { queue, startIndex } = buildSetlistQueue(resolvedEntries, entryId);
    if (queue.length === 0) return;
    useStore.getState().setPlayerQueue(queue, startIndex, true);
  }

  const builderSong = useMemo(() => {
    if (!builder?.ideaId) return null;
    const resolved = findIdea(workspaces, builder.ideaId);
    if (!resolved) return null;
    const { idea } = resolved;
    return {
      title: idea.title,
      clips: idea.clips.map((c) => ({
        id: c.id,
        title: c.title,
        isPrimary: c.isPrimary,
        durationMs: c.durationMs ?? null,
        sectionCount: c.sections?.length ?? 0,
        pinCount: c.practiceMarkers?.length ?? 0,
      })),
      versions: (idea.lyrics?.versions ?? []).map((v, i) => ({ id: v.id, label: `Version ${i + 1}` })),
      hasChordSheet: !!idea.chordSheet && idea.chordSheet.sections.length > 0,
      hasNotes: idea.notes.trim().length > 0,
      notesPreview: idea.notes.trim().slice(0, 64),
    };
  }, [builder?.ideaId, workspaces]);

  const handleBack = () => {
    if (builder) {
      setBuilder(null);
      return;
    }
    setSelectedSetlistId(null);
  };

  return {
    sortedSetlists,
    activeSetlist,
    resolvedEntries,
    setDurationMs,
    nowPlayingEntryId,
    isPlayerPlaying,
    builder,
    builderSong,
    showBack: !!activeSetlist || !!builder,
    createModalOpen,
    setCreateModalOpen,
    renameModalOpen,
    setRenameModalOpen,
    draftTitle,
    setDraftTitle,
    draftDescription,
    setDraftDescription,
    defaultTitle: `Setlist ${setlists.length + 1}`,
    handleBack,
    openSetlist: (id: string) => setSelectedSetlistId(id),
    openCreate: () => {
      setDraftTitle("");
      setCreateModalOpen(true);
    },
    createSetlist: () => {
      const id = addSetlist(draftTitle.trim() || `Setlist ${setlists.length + 1}`);
      setCreateModalOpen(false);
      setDraftTitle("");
      setSelectedSetlistId(id);
    },
    /** "Set details" — the title and the set's own note, one sheet. */
    openRename: () => {
      if (!activeSetlist) return;
      setDraftTitle(activeSetlist.title);
      setDraftDescription(activeSetlist.description ?? "");
      setRenameModalOpen(true);
    },
    renameActiveSetlist: () => {
      if (!activeSetlist) return;
      const title = draftTitle.trim();
      renameSetlist(activeSetlist.id, title || activeSetlist.title, draftDescription);
      setRenameModalOpen(false);
      setDraftTitle("");
      setDraftDescription("");
    },

    /** Play the whole set (or from one entry) into the dock. */
    playAll: () => playFromEntry(),
    playFromEntry,

    /** "Add a song": the shared picker out in the real collections — browse,
     *  preview, pick across collections and workspaces; each pick lands as a
     *  default-packed entry (primary take + latest lyrics + chart). */
    startCollecting: () => {
      if (!activeSetlist) return;
      useStore.getState().startLibraryCollecting("setlist", activeSetlist.id, activeSetlist.title);
      setBuilder(null);
      navigation.navigate("WorkspaceStack", { screen: "Browse", params: undefined });
    },

    /** Open an entry's packaged song folder. */
    openEntryFolder: (entryId: string) => {
      if (!activeSetlist) return;
      navigateRoot("SetlistSong", { setlistId: activeSetlist.id, entryId });
    },

    // ── Package builder (repack an entry) ───────────────────────────────────
    builderToggleClip: (clipId: string) =>
      setBuilder((cur) => (cur ? { ...cur, clipIds: toggle(cur.clipIds, clipId) } : cur)),
    builderToggleVersion: (versionId: string) =>
      setBuilder((cur) => (cur ? { ...cur, lyricVersionIds: toggle(cur.lyricVersionIds, versionId) } : cur)),
    builderToggleChordSheet: () =>
      setBuilder((cur) => (cur ? { ...cur, includeChordSheet: !cur.includeChordSheet } : cur)),
    builderToggleSongNotes: () =>
      setBuilder((cur) => (cur ? { ...cur, includeSongNotes: !cur.includeSongNotes } : cur)),
    /** "Everything" — pack every take, the latest lyric version, chart, notes. */
    builderSelectEverything: () => {
      if (!builder?.ideaId) return;
      const resolved = findIdea(workspaces, builder.ideaId);
      const idea = resolved?.idea;
      if (!idea) return;
      const latestVersion = idea.lyrics?.versions[idea.lyrics.versions.length - 1];
      setBuilder((cur) =>
        cur
          ? {
              ...cur,
              clipIds: idea.clips.map((c) => c.id),
              lyricVersionIds: latestVersion ? [latestVersion.id] : [],
              includeChordSheet: !!idea.chordSheet && idea.chordSheet.sections.length > 0,
              includeSongNotes: idea.notes.trim().length > 0,
            }
          : cur
      );
    },
    confirmBuilder: () => {
      if (!builder?.editingEntryId) return;
      updateSetlistEntry(builder.setlistId, builder.editingEntryId, {
        clipIds: builder.clipIds,
        lyricVersionIds: builder.lyricVersionIds,
        includeChordSheet: builder.includeChordSheet,
        includeSongNotes: builder.includeSongNotes,
      });
      setBuilder(null);
    },
    editEntry: (entryId: string) => {
      if (!activeSetlist) return;
      const entry = activeSetlist.entries.find((e) => e.id === entryId);
      if (!entry) return;
      setBuilder({
        setlistId: activeSetlist.id,
        workspaceId: entry.workspaceId,
        ideaId: entry.ideaId,
        editingEntryId: entry.id,
        clipIds: entry.clipIds,
        lyricVersionIds: entry.lyricVersionIds,
        includeChordSheet: entry.includeChordSheet,
        includeSongNotes: !!entry.includeSongNotes,
      });
    },
    removeEntry: (entryId: string) => activeSetlist && removeSetlistEntry(activeSetlist.id, entryId),
    reorderEntries: (orderedEntryIds: string[]) =>
      activeSetlist && reorderSetlistEntries(activeSetlist.id, orderedEntryIds),
    deleteActiveSetlist: () => {
      if (!activeSetlist) return;
      deleteSetlist(activeSetlist.id);
      setSelectedSetlistId(null);
    },
    shareActiveSetlist: async () => {
      if (!activeSetlist) return;
      try {
        const ok = await shareSetlist(activeSetlist, workspaces);
        if (!ok) AppAlert.info(t("library.nothingShare"), t("library.addSetSongFirst"));
      } catch {
        AppAlert.info(t("songDetail.shareFailed"), t("library.setlistShareFailed"));
      }
    },
    getLinkForActiveSetlist: () => {
      if (!activeSetlist) return;
      const setlist = activeSetlist;
      openSendSheet({
        title: setlist.title,
        kind: "setlist",
        emptyMessage: t("library.addSetSongFirst"),
        create: (parcel) => createSetlistShareLink(setlist, workspaces, parcel),
      });
    },
  };
}
