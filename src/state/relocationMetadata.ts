import type { ActivityEvent, Playlist } from "../types";

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
