import type { ShareKind, SongIdea, Workspace } from "../types";
import { buildClipLineages } from "./clipGraph";

/**
 * The parcel's front door (2026-10-14, founder: a new user "doesn't know to
 * click Keep", lands in Received and is lost). One sheet says what arrived,
 * lists exactly what is inside, and offers ONE key named by kind. This file
 * is the pure half: what the sheet prints and what Keep does by default.
 */

export type ParcelRow = {
    key: string;
    icon: "folder" | "sketch" | "clip";
    title: string;
    /** "3 takes · Lyrics · Chart", "5 items", … */
    meta: string;
};

export type ParcelCopy = {
    takes: (count: number) => string;
    items: (count: number) => string;
    lyrics: string;
    chart: string;
};

/** How many rows the sheet prints before "+N more". */
export const PARCEL_ROWS_MAX = 6;

function ideaMeta(idea: SongIdea, copy: ParcelCopy): string {
    // A sketch's takes count as the sketch page counts them: a take and its older
    // versions are one take.
    const takes = idea.kind === "project" ? buildClipLineages(idea.clips).length : idea.clips.length;
    const parts: string[] = [copy.takes(takes)];
    if (idea.kind === "project") {
        const hasLyrics = (idea.lyrics?.versions ?? []).some((version) =>
            version.document.lines.some((line) => line.text.trim().length > 0)
        );
        const hasChart = !!idea.chordSheet?.sections.some((section) =>
            section.kind === "text" ? !!section.text?.trim() : section.measures.length > 0
        );
        if (hasLyrics) parts.push(copy.lyrics);
        if (hasChart) parts.push(copy.chart);
    }
    return parts.join(" · ");
}

function ideasIn(pkg: Workspace, collectionId: string): SongIdea[] {
    const nested = new Set<string>([collectionId]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const collection of pkg.collections) {
            if (collection.parentCollectionId && nested.has(collection.parentCollectionId) && !nested.has(collection.id)) {
                nested.add(collection.id);
                grew = true;
            }
        }
    }
    return pkg.ideas.filter((idea) => nested.has(idea.collectionId));
}

/**
 * What the parcel holds, as the sheet lists it. A workspace shows its
 * collections; a collection its sub-collections then its ideas; a sketch or
 * clips their ideas. Nothing is hidden behind a tap.
 */
export function parcelRows(pkg: Workspace, copy: ParcelCopy): ParcelRow[] {
    const kind = pkg.received?.shareKind ?? "library";
    const topLevel = pkg.collections.filter((collection) => !collection.parentCollectionId);
    const collectionRow = (collection: Workspace["collections"][number]): ParcelRow => ({
        key: `c-${collection.id}`,
        icon: "folder",
        title: collection.title,
        meta: copy.items(ideasIn(pkg, collection.id).length),
    });
    const ideaRow = (idea: SongIdea): ParcelRow => ({
        key: `i-${idea.id}`,
        icon: idea.kind === "project" ? "sketch" : "clip",
        title: idea.title,
        meta: ideaMeta(idea, copy),
    });

    if (kind === "workspace" || kind === "library" || topLevel.length > 1) {
        return topLevel.map(collectionRow);
    }
    const only = topLevel[0];
    if (!only) return pkg.ideas.map(ideaRow);
    const children = pkg.collections.filter((collection) => collection.parentCollectionId === only.id);
    const direct = pkg.ideas.filter((idea) => idea.collectionId === only.id);
    return [...children.map(collectionRow), ...direct.map(ideaRow)];
}

export type KeepPlan =
    | { mode: "own-workspace" }
    | { mode: "into"; workspaceId: string };

/**
 * What the one key does. A workspace becomes your own workspace. Anything
 * else goes into the workspace you are in, at the top level; with no
 * workspace of your own to land in, it becomes a workspace too.
 */
export function defaultKeepPlan(pkg: Workspace, activeWorkspace: Workspace | null | undefined): KeepPlan {
    const kind = pkg.received?.shareKind ?? "library";
    if (kind === "workspace" || kind === "library") return { mode: "own-workspace" };
    if (!activeWorkspace || activeWorkspace.origin === "received" || activeWorkspace.isArchived) {
        return { mode: "own-workspace" };
    }
    return { mode: "into", workspaceId: activeWorkspace.id };
}

/** The i18n key of the one key's label, by kind. */
export function keepLabelKey(kind: ShareKind): string {
    switch (kind) {
        case "workspace":
        case "library":
            return "received.keepWorkspace";
        case "collection":
            return "received.keepCollection";
        case "sketch":
            return "received.keepSketch";
        case "clips":
            return "received.keepClips";
        default:
            return "received.keepParcel";
    }
}

/**
 * On Keep, the sender's note moves to where notes already live on what was kept,
 * so it stays with the thing after the parcel is gone: one sketch → its notes,
 * one clip → its take's note, one collection → its description, more → the
 * workspace's description. Signed with the sender's name; never duplicated.
 */
export function withSenderNote(pkg: Workspace): Workspace {
    const message = pkg.received?.message?.trim();
    if (!message) return pkg;
    const note = pkg.received?.senderName ? `${pkg.received.senderName}: ${message}` : message;
    const join = (existing: string | undefined) =>
        existing?.includes(message) ? existing : existing?.trim() ? `${note}\n\n${existing}` : note;
    const received = { ...pkg.received!, message: undefined };

    if (pkg.ideas.length === 1) {
        const idea = pkg.ideas[0]!;
        if (idea.kind === "project") return { ...pkg, received, ideas: [{ ...idea, notes: join(idea.notes) }] };
        const primaryId = (idea.clips.find((clip) => clip.isPrimary) ?? idea.clips[0])?.id;
        return {
            ...pkg,
            received,
            ideas: [
                {
                    ...idea,
                    clips: idea.clips.map((clip) => (clip.id === primaryId ? { ...clip, notes: join(clip.notes) } : clip)),
                },
            ],
        };
    }
    const topLevel = pkg.collections.filter((collection) => !collection.parentCollectionId);
    if (topLevel.length === 1) {
        const only = topLevel[0]!;
        return {
            ...pkg,
            received,
            collections: pkg.collections.map((collection) =>
                collection.id === only.id ? { ...collection, description: join(collection.description) } : collection
            ),
        };
    }
    return { ...pkg, received, description: join(pkg.description) };
}
