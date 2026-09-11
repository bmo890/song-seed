import { useStore } from "./useStore";
import { getPlayableClipForIdea } from "../domain/clipPresentation";
import { buildDefaultSongbookItemsForIdea } from "../domain/songbookGrouping";

/**
 * Add ideas from the active workspace to whatever compilation is collecting
 * (`libraryCollector`). One place for the three kinds, so the selection dock's
 * Add and the banner's Done put the same things in the same shape:
 *  - playlist: songs as song items, clips pin their playable clip;
 *  - songbook: each song's default charts (ideas without charts are skipped);
 *  - setlist: a default-packed entry per idea (primary clip + latest lyrics +
 *    chord chart when present).
 * Returns how many ideas landed, and `noCharts` when a songbook add found none.
 */
export function addIdeasToLibraryCollector(ideaIds: string[]): { added: number; noCharts: boolean } {
    const state = useStore.getState();
    const collector = state.libraryCollector;
    const activeWorkspace = state.workspaces.find((ws) => ws.id === state.activeWorkspaceId);
    if (!collector || !activeWorkspace || ideaIds.length === 0) return { added: 0, noCharts: false };
    const ideas = ideaIds
        .map((id) => activeWorkspace.ideas.find((idea) => idea.id === id))
        .filter((idea): idea is NonNullable<typeof idea> => !!idea);
    if (ideas.length === 0) return { added: 0, noCharts: false };

    let added = 0;
    if (collector.kind === "playlist") {
        state.addItemsToPlaylist(
            collector.targetId,
            ideas.map((idea) => ({
                kind: idea.kind === "project" ? ("song" as const) : ("clip" as const),
                workspaceId: activeWorkspace.id,
                collectionId: idea.collectionId,
                ideaId: idea.id,
                clipId: idea.kind === "project" ? null : getPlayableClipForIdea(idea)?.id ?? null,
            }))
        );
        added = ideas.length;
    } else if (collector.kind === "songbook") {
        for (const idea of ideas) {
            const defaults = buildDefaultSongbookItemsForIdea(idea);
            if (defaults.length === 0) continue;
            state.addItemsToSongbook(
                collector.targetId,
                defaults.map((choice) => ({
                    kind: choice.kind,
                    workspaceId: activeWorkspace.id,
                    ideaId: idea.id,
                    versionId: choice.versionId,
                }))
            );
            added += 1;
        }
        if (added === 0) return { added: 0, noCharts: true };
    } else {
        for (const idea of ideas) {
            const primary = getPlayableClipForIdea(idea);
            const latestVersion = idea.lyrics?.versions[idea.lyrics.versions.length - 1];
            state.addSetlistEntry(collector.targetId, {
                workspaceId: activeWorkspace.id,
                ideaId: idea.id,
                clipIds: primary ? [primary.id] : [],
                lyricVersionIds: latestVersion ? [latestVersion.id] : [],
                includeChordSheet: !!idea.chordSheet && idea.chordSheet.sections.length > 0,
                includeSongNotes: false,
            });
            added += 1;
        }
    }
    state.noteLibraryCollectorAdded(added);
    return { added, noCharts: false };
}
