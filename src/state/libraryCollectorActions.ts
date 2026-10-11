import { useStore } from "./useStore";
import { getPlayableClipForIdea } from "../domain/clipPresentation";
import { buildDefaultSongbookItemsForIdea } from "../domain/songbookGrouping";
import { resolveCollectorPicks } from "../domain/libraryCollectorPicks";

/**
 * Commit the collecting session's basket to whatever compilation is collecting
 * (`libraryCollector`). One place for the three kinds, so the same picks land in
 * the same shape wherever Add was pressed:
 *  - playlist: songs as song items, clips pin their playable clip;
 *  - songbook: each song's default charts (ideas without charts are skipped);
 *  - setlist: a default-packed entry per idea (primary clip + latest lyrics +
 *    chord chart when present). A setlist takes anything — a lyrics-only
 *    sketch is a valid set entry (founder, 2026-10-11).
 * Picks resolve in their own workspace, so a basket gathered across workspaces
 * commits whole. Returns how many ideas landed, and `noCharts` when a songbook
 * add found none.
 */
export function addLibraryCollectorPicks(): { added: number; noCharts: boolean } {
    const state = useStore.getState();
    const collector = state.libraryCollector;
    if (!collector || collector.picks.length === 0) return { added: 0, noCharts: false };
    const resolved = resolveCollectorPicks(state.workspaces, collector.picks);
    if (resolved.length === 0) return { added: 0, noCharts: false };

    let added = 0;
    if (collector.kind === "playlist") {
        state.addItemsToPlaylist(
            collector.targetId,
            resolved.map(({ workspace, idea }) => ({
                kind: idea.kind === "project" ? ("song" as const) : ("clip" as const),
                workspaceId: workspace.id,
                collectionId: idea.collectionId,
                ideaId: idea.id,
                clipId: idea.kind === "project" ? null : getPlayableClipForIdea(idea)?.id ?? null,
            }))
        );
        added = resolved.length;
    } else if (collector.kind === "songbook") {
        for (const { workspace, idea } of resolved) {
            const defaults = buildDefaultSongbookItemsForIdea(idea);
            if (defaults.length === 0) continue;
            state.addItemsToSongbook(
                collector.targetId,
                defaults.map((choice) => ({
                    kind: choice.kind,
                    workspaceId: workspace.id,
                    ideaId: idea.id,
                    versionId: choice.versionId,
                }))
            );
            added += 1;
        }
        if (added === 0) return { added: 0, noCharts: true };
    } else {
        for (const { workspace, idea } of resolved) {
            const primary = getPlayableClipForIdea(idea);
            const latestVersion = idea.lyrics?.versions[idea.lyrics.versions.length - 1];
            state.addSetlistEntry(collector.targetId, {
                workspaceId: workspace.id,
                ideaId: idea.id,
                clipIds: primary ? [primary.id] : [],
                lyricVersionIds: latestVersion ? [latestVersion.id] : [],
                includeChordSheet: !!idea.chordSheet && idea.chordSheet.sections.length > 0,
                includeSongNotes: false,
            });
            added += 1;
        }
    }
    return { added, noCharts: false };
}
