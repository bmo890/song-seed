import { useMemo, useState } from "react";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { shareSetlist } from "../../../services/setlistShare";
import type { SongIdea, Workspace } from "../../../types";

type BuilderState = {
  setlistId: string;
  workspaceId: string | null;
  ideaId: string | null;
  editingEntryId: string | null;
  clipIds: string[];
  lyricVersionIds: string[];
  includeChordSheet: boolean;
};

export type SetlistDisplayEntry = {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  available: boolean;
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
  const workspaces = useStore((s) => s.workspaces);
  const setlists = useStore((s) => s.setlists);
  const addSetlist = useStore((s) => s.addSetlist);
  const addSetlistEntry = useStore((s) => s.addSetlistEntry);
  const updateSetlistEntry = useStore((s) => s.updateSetlistEntry);
  const removeSetlistEntry = useStore((s) => s.removeSetlistEntry);
  const reorderSetlistEntries = useStore((s) => s.reorderSetlistEntries);
  const deleteSetlist = useStore((s) => s.deleteSetlist);

  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(null);
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  const sortedSetlists = useMemo(
    () => setlists.slice().sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title)),
    [setlists]
  );

  const activeSetlistId = builder?.setlistId ?? selectedSetlistId;
  const activeSetlist = setlists.find((sl) => sl.id === activeSetlistId) ?? null;

  const displayEntries = useMemo<SetlistDisplayEntry[]>(() => {
    if (!activeSetlist) return [];
    return activeSetlist.entries.map((entry) => {
      const resolved = findIdea(workspaces, entry.ideaId);
      const chartCount = entry.lyricVersionIds.length + (entry.includeChordSheet ? 1 : 0);
      const summary = `${entry.clipIds.length} clip${entry.clipIds.length === 1 ? "" : "s"} · ${chartCount} chart${chartCount === 1 ? "" : "s"}`;
      return {
        id: entry.id,
        title: resolved?.idea.title ?? "Unavailable song",
        subtitle: resolved ? resolved.workspace.title : "Its song no longer exists.",
        summary,
        available: !!resolved,
      };
    });
  }, [activeSetlist, workspaces]);

  const pickerWorkspaces = useMemo(
    () =>
      workspaces
        .filter((w) => !w.isArchived)
        .map((w) => ({ id: w.id, title: w.title, songs: w.ideas.filter((i) => i.kind === "project") }))
        .filter((w) => w.songs.length > 0),
    [workspaces]
  );

  const builderSong = useMemo(() => {
    if (!builder?.ideaId) return null;
    const resolved = findIdea(workspaces, builder.ideaId);
    if (!resolved) return null;
    const { idea } = resolved;
    return {
      title: idea.title,
      clips: idea.clips.map((c) => ({ id: c.id, title: c.title, isPrimary: c.isPrimary })),
      versions: (idea.lyrics?.versions ?? []).map((v, i) => ({ id: v.id, label: `Version ${i + 1}` })),
      hasChordSheet: !!idea.chordSheet && idea.chordSheet.sections.length > 0,
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
    displayEntries,
    builder,
    builderSong,
    pickerWorkspaces,
    showBack: !!activeSetlist || !!builder,
    createModalOpen,
    setCreateModalOpen,
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
    confirmBuilder: () => {
      if (!builder || !builder.ideaId || !builder.workspaceId) return;
      const payload = {
        workspaceId: builder.workspaceId,
        ideaId: builder.ideaId,
        clipIds: builder.clipIds,
        lyricVersionIds: builder.lyricVersionIds,
        includeChordSheet: builder.includeChordSheet,
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
