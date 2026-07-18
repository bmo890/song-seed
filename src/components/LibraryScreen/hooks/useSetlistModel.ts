import { useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { shareSetlist } from "../../../services/setlistShare";
import { personalWorkspaces } from "../../../domain/workspaceVisibility";
import {
  buildSetlistQueue,
  getSetlistDurationMs,
  resolveSetlistEntries,
  type ResolvedSetlistEntry,
} from "../../../domain/setlistPlayback";
import type { SongIdea, Workspace } from "../../../types";

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
  const navigation = useNavigation<any>();
  const rootNavigation = navigation.getParent?.();
  const navigateRoot = (route: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(route as never, params as never);

  const workspaces = useStore((s) => s.workspaces);
  const setlists = useStore((s) => s.setlists);
  const addSetlist = useStore((s) => s.addSetlist);
  const addSetlistEntry = useStore((s) => s.addSetlistEntry);
  const updateSetlistEntry = useStore((s) => s.updateSetlistEntry);
  const removeSetlistEntry = useStore((s) => s.removeSetlistEntry);
  const reorderSetlistEntries = useStore((s) => s.reorderSetlistEntries);
  const renameSetlist = useStore((s) => s.renameSetlist);
  const deleteSetlist = useStore((s) => s.deleteSetlist);
  const playerTarget = useStore((s) => s.playerTarget);
  const isPlayerPlaying = useStore((s) => s.playerIsPlaying);

  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(null);
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

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
    if (builder?.ideaId && !builder.editingEntryId) {
      setBuilder((cur) => (cur ? { ...cur, ideaId: null, workspaceId: null } : cur));
      return;
    }
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
    pickerWorkspaces: useMemo(
      () =>
        personalWorkspaces(workspaces)
          .filter((w) => !w.isArchived)
          .map((w) => ({ id: w.id, title: w.title, songs: w.ideas.filter((i) => i.kind === "project") }))
          .filter((w) => w.songs.length > 0),
      [workspaces]
    ),
    showBack: !!activeSetlist || !!builder,
    createModalOpen,
    setCreateModalOpen,
    renameModalOpen,
    setRenameModalOpen,
    draftTitle,
    setDraftTitle,
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
    openRename: () => {
      if (!activeSetlist) return;
      setDraftTitle(activeSetlist.title);
      setRenameModalOpen(true);
    },
    renameActiveSetlist: () => {
      if (!activeSetlist) return;
      const title = draftTitle.trim();
      if (title) renameSetlist(activeSetlist.id, title);
      setRenameModalOpen(false);
      setDraftTitle("");
    },

    /** Play the whole set (or from one entry) into the dock. */
    playAll: () => playFromEntry(),
    playFromEntry,

    /** Multi-select from the real collections: default-packed entries per song. */
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

    // ── Package builder ─────────────────────────────────────────────────────
    openBuilder: () => {
      if (!activeSetlist) return;
      setBuilder({
        setlistId: activeSetlist.id,
        workspaceId: null,
        ideaId: null,
        editingEntryId: null,
        clipIds: [],
        lyricVersionIds: [],
        includeChordSheet: false,
        includeSongNotes: false,
      });
    },
    builderSelectSong: (workspaceId: string, ideaId: string) => {
      const resolved = findIdea(workspaces, ideaId);
      const idea = resolved?.idea;
      const primary = idea?.clips.find((c) => c.isPrimary) ?? idea?.clips[0];
      const latestVersion = idea?.lyrics?.versions[idea.lyrics.versions.length - 1];
      setBuilder((cur) =>
        cur
          ? {
              ...cur,
              workspaceId,
              ideaId,
              clipIds: primary ? [primary.id] : [],
              lyricVersionIds: latestVersion ? [latestVersion.id] : [],
              includeChordSheet: !!idea?.chordSheet && idea.chordSheet.sections.length > 0,
              includeSongNotes: false,
            }
          : cur
      );
    },
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
      if (!builder || !builder.ideaId || !builder.workspaceId) return;
      const payload = {
        workspaceId: builder.workspaceId,
        ideaId: builder.ideaId,
        clipIds: builder.clipIds,
        lyricVersionIds: builder.lyricVersionIds,
        includeChordSheet: builder.includeChordSheet,
        includeSongNotes: builder.includeSongNotes,
      };
      if (builder.editingEntryId) {
        updateSetlistEntry(builder.setlistId, builder.editingEntryId, payload);
      } else {
        addSetlistEntry(builder.setlistId, payload);
      }
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
        if (!ok) AppAlert.info("Nothing to share", "Add at least one song to the setlist first.");
      } catch {
        AppAlert.info("Share failed", "Couldn't build the setlist file. Please try again.");
      }
    },
  };
}
