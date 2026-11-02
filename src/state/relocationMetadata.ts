import type { ActivityEvent, Playlist, Setlist, Songbook, Workspace } from "../types";
import { getIdeaIndex } from "./librarySelectors";

export type RelocatedIdeaReference = {
    ideaId: string;
    workspaceId: string;
    collectionId: string;
    ideaKind: "song" | "clip";
    ideaTitle: string;
};

export type RelocatedClipReference = RelocatedIdeaReference & {
    clipId: string;
};

type RelocationPayload = {
    ideas?: Iterable<RelocatedIdeaReference>;
    clips?: Iterable<RelocatedClipReference>;
};

export function relocateActivityEvents(
    events: ActivityEvent[],
    { ideas = [], clips = [] }: RelocationPayload
) {
    const ideaMap = new Map(Array.from(ideas, (entry) => [entry.ideaId, entry] as const));
    const clipMap = new Map(Array.from(clips, (entry) => [entry.clipId, entry] as const));

    return events.map((event) => {
        const clipRelocation =
            event.clipId && clipMap.has(event.clipId) ? clipMap.get(event.clipId)! : null;
        if (clipRelocation) {
            return {
                ...event,
                workspaceId: clipRelocation.workspaceId,
                collectionId: clipRelocation.collectionId,
                ideaId: clipRelocation.ideaId,
                ideaKind: clipRelocation.ideaKind,
                ideaTitle: clipRelocation.ideaTitle,
            };
        }

        const ideaRelocation = ideaMap.get(event.ideaId) ?? null;
        if (!ideaRelocation) {
            return event;
        }

        return {
            ...event,
            workspaceId: ideaRelocation.workspaceId,
            collectionId: ideaRelocation.collectionId,
            ideaId: ideaRelocation.ideaId,
            ideaKind: ideaRelocation.ideaKind,
            ideaTitle: ideaRelocation.ideaTitle,
        };
    });
}

export function relocatePlaylists(
    playlists: Playlist[],
    { ideas = [], clips = [] }: RelocationPayload
) {
    const ideaMap = new Map(Array.from(ideas, (entry) => [entry.ideaId, entry] as const));
    const clipMap = new Map(Array.from(clips, (entry) => [entry.clipId, entry] as const));

    return playlists.map((playlist) => ({
        ...playlist,
        items: playlist.items.map((item) => {
            const clipRelocation =
                item.clipId && clipMap.has(item.clipId) ? clipMap.get(item.clipId)! : null;
            if (clipRelocation) {
                return {
                    ...item,
                    workspaceId: clipRelocation.workspaceId,
                    collectionId: clipRelocation.collectionId,
                    ideaId: clipRelocation.ideaId,
                };
            }

            const ideaRelocation = ideaMap.get(item.ideaId) ?? null;
            if (!ideaRelocation) {
                return item;
            }

            return {
                ...item,
                workspaceId: ideaRelocation.workspaceId,
                collectionId: ideaRelocation.collectionId,
                ideaId: ideaRelocation.ideaId,
            };
        }),
    }));
}

/**
 * Setlist entries and chart-book items name the workspace their song lives in. A
 * move across workspaces (a collection move, Keep on a parcel, a paste-move, the
 * recorder's save picker) must carry that along, or a later delete of the old
 * workspace prunes the entries (data-safety audit 04-H1: Keep emptied a received
 * setlist). Re-reads each entry's song from the library; lists with nothing to
 * change keep their identity.
 */
export function rehomeCompilations(
    workspaces: Workspace[],
    songbooks: Songbook[],
    setlists: Setlist[]
): { songbooks: Songbook[]; setlists: Setlist[] } {
    const homeOf = getIdeaIndex(workspaces).workspaceIdByIdeaId;
    const rehome = <T extends { ideaId: string; workspaceId: string }>(entries: T[]): T[] => {
        let changed = false;
        const next = entries.map((entry) => {
            const home = homeOf.get(entry.ideaId);
            if (!home || home === entry.workspaceId) return entry;
            changed = true;
            return { ...entry, workspaceId: home };
        });
        return changed ? next : entries;
    };
    let booksChanged = false;
    const nextBooks = songbooks.map((book) => {
        const items = rehome(book.items);
        if (items === book.items) return book;
        booksChanged = true;
        return { ...book, items };
    });
    let setsChanged = false;
    const nextSets = setlists.map((setlist) => {
        const entries = rehome(setlist.entries);
        if (entries === setlist.entries) return setlist;
        setsChanged = true;
        return { ...setlist, entries };
    });
    return { songbooks: booksChanged ? nextBooks : songbooks, setlists: setsChanged ? nextSets : setlists };
}
