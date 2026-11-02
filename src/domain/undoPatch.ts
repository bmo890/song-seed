import type { ActivityEvent, Playlist, SongIdea, Workspace } from "../types";

/**
 * Undo reverses only what its action did (audit 2026-11-02, root cause 3).
 *
 * The undo toasts used to put back a copy of everything taken before the action (a
 * whole workspace's ideas, a whole spark's word list), so whatever happened during the
 * five-second window was erased with it: a take that landed, a rename, a word added.
 * These build the inverse of one action against the library as it is when Undo is
 * pressed.
 */

/** Put `id` back where it stood in `before`, among the items still in `live`. */
export function restoreRemovedItem<T extends { id: string }>(live: T[], before: T[], id: string): T[] {
    if (live.some((item) => item.id === id)) return live;
    const index = before.findIndex((item) => item.id === id);
    if (index < 0) return live;
    const liveIds = new Set(live.map((item) => item.id));
    // After the nearest earlier neighbour that is still there; first when none is.
    for (let i = index - 1; i >= 0; i -= 1) {
        if (!liveIds.has(before[i]!.id)) continue;
        const at = live.findIndex((item) => item.id === before[i]!.id);
        return [...live.slice(0, at + 1), before[index]!, ...live.slice(at + 1)];
    }
    return [before[index]!, ...live];
}

export type MadeSketch = {
    workspaceId: string;
    /** The sketch as it was made. */
    sketch: SongIdea;
    /** The clip ideas it gathered, as they were. */
    gatheredIdeas: SongIdea[];
    /** The workspace's collections before, for the gathered ideas' hidden state. */
    collections: Workspace["collections"];
    /** Activity and playlists before the gather relocated them to the sketch. */
    activityEvents: ActivityEvent[];
    playlists: Playlist[];
};

type UndoableLibrary = {
    workspaces: Workspace[];
    activityEvents: ActivityEvent[];
    playlists: Playlist[];
};

/**
 * Undo "Make sketch": the gathered clip ideas come back as they were and leave the
 * sketch. Everything else stays as it is now. A sketch the person has made their own
 * since (saved it, or recorded a take into it) stays, holding what it gained; a sketch
 * still exactly as made goes.
 */
export function undoMadeSketch<S extends UndoableLibrary>(live: S, made: MadeSketch): Partial<S> {
    const gatheredIds = new Set(made.gatheredIdeas.map((idea) => idea.id));
    const gatheredClipIds = new Set(made.gatheredIdeas.flatMap((idea) => idea.clips.map((clip) => clip.id)));
    const workspaces = live.workspaces.map((workspace) => {
        if (workspace.id !== made.workspaceId) return workspace;
        const present = new Set(workspace.ideas.map((idea) => idea.id));
        const comeBack = made.gatheredIdeas.filter((idea) => !present.has(idea.id));
        const ideas = workspace.ideas.flatMap((idea): SongIdea[] => {
            if (idea.id !== made.sketch.id) return [idea];
            if (idea === made.sketch) return [];
            const kept = idea.clips.filter((clip) => !gatheredClipIds.has(clip.id));
            const ownSketch = !idea.isDraft || kept.length > 0;
            if (!ownSketch) return [];
            const hasPrimary = kept.some((clip) => clip.isPrimary);
            return [
                {
                    ...idea,
                    clips: hasPrimary ? kept : kept.map((clip, index) => ({ ...clip, isPrimary: index === 0 })),
                },
            ];
        });
        // A gathered idea that was hidden in its list is hidden again.
        const hiddenBefore = new Map(made.collections.map((c) => [c.id, c.ideasListState?.hiddenIdeaIds ?? []]));
        const collections = workspace.collections.map((collection) => {
            const rehide = (hiddenBefore.get(collection.id) ?? []).filter((id) => gatheredIds.has(id));
            if (rehide.length === 0) return collection;
            const hidden = new Set([...(collection.ideasListState?.hiddenIdeaIds ?? []), ...rehide]);
            return {
                ...collection,
                ideasListState: {
                    hiddenDays: collection.ideasListState?.hiddenDays ?? [],
                    hiddenIdeaIds: [...hidden],
                },
            };
        });
        return { ...workspace, collections, ideas: [...comeBack, ...ideas] };
    });

    // What the gather pointed at the sketch points back at the clip ideas.
    const eventBefore = new Map(made.activityEvents.map((event) => [event.id, event]));
    const activityEvents = live.activityEvents.map((event) => {
        const before = eventBefore.get(event.id);
        return before && gatheredIds.has(before.ideaId) ? before : event;
    });
    const playlists = live.playlists.map((playlist) => {
        const before = made.playlists.find((candidate) => candidate.id === playlist.id);
        if (!before) return playlist;
        const itemBefore = new Map(before.items.map((item) => [item.id, item]));
        return {
            ...playlist,
            items: playlist.items.map((item) => {
                const prior = itemBefore.get(item.id);
                return prior && gatheredIds.has(prior.ideaId) ? prior : item;
            }),
        };
    });
    return { workspaces, activityEvents, playlists } as Partial<S>;
}
