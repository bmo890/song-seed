import * as FileSystem from "expo-file-system/legacy";
import type { Playlist, SongIdea, Workspace } from "../types";
import { SONG_SEED_AUDIO_DIR } from "./storagePaths";
import { collectManagedAudioUrisFromWorkspaces } from "./managedMedia";

/**
 * Read-only structural + referential integrity scan of the library. Surfaces the problems
 * that silently corrupt a recording archive: duplicate IDs, broken lineage, dangling
 * references, missing audio files, and true orphans.
 *
 * Orphan detection is overdub-aware — it treats clip audio, source audio, overdub stems,
 * AND rendered mixes as "referenced", so stems/mixes are never mistaken for standalone
 * orphans (the gap in the older recovery scan).
 */

export type IntegrityIssue =
    | { type: "duplicate-id"; scope: "workspace" | "collection" | "idea" | "clip" | "overdub-stem"; id: string }
    | { type: "lineage-cycle"; ideaId: string; clipId: string }
    | { type: "dangling-parent"; ideaId: string; clipId: string; parentClipId: string }
    | { type: "dangling-group-assignment"; ideaId: string; clipId: string; groupId: string }
    | { type: "missing-primary"; ideaId: string }
    | { type: "multiple-primary"; ideaId: string; count: number }
    | { type: "dangling-playlist-item"; playlistId: string; itemId: string; reason: string }
    | { type: "missing-file"; ref: string; path: string }
    | { type: "orphan-file"; path: string };

export type IntegrityReport = {
    scannedAt: string;
    counts: { workspaces: number; collections: number; ideas: number; clips: number };
    issues: IntegrityIssue[];
    ok: boolean;
};

function checkUniqueIds(workspaces: Workspace[], issues: IntegrityIssue[]) {
    const seen = {
        workspace: new Set<string>(),
        collection: new Set<string>(),
        idea: new Set<string>(),
        clip: new Set<string>(),
        "overdub-stem": new Set<string>(),
    } as const;

    const note = (scope: keyof typeof seen, id: string) => {
        if (seen[scope].has(id)) issues.push({ type: "duplicate-id", scope, id });
        else seen[scope].add(id);
    };

    for (const workspace of workspaces) {
        note("workspace", workspace.id);
        for (const collection of workspace.collections) note("collection", collection.id);
        for (const idea of workspace.ideas) {
            note("idea", idea.id);
            for (const clip of idea.clips) {
                note("clip", clip.id);
                for (const stem of clip.overdub?.stems ?? []) note("overdub-stem", stem.id);
            }
        }
    }
}

function checkIdeaLineageAndGroups(idea: SongIdea, issues: IntegrityIssue[]) {
    const clipIds = new Set(idea.clips.map((clip) => clip.id));
    const byId = new Map(idea.clips.map((clip) => [clip.id, clip]));

    // Dangling parent references.
    for (const clip of idea.clips) {
        if (clip.parentClipId && !clipIds.has(clip.parentClipId)) {
            issues.push({
                type: "dangling-parent",
                ideaId: idea.id,
                clipId: clip.id,
                parentClipId: clip.parentClipId,
            });
        }
    }

    // Lineage cycles: walk each clip's parent chain, flag if it returns to a visited node.
    for (const start of idea.clips) {
        const visited = new Set<string>();
        let cursor = start.parentClipId ? byId.get(start.parentClipId) : undefined;
        while (cursor) {
            if (cursor.id === start.id || visited.has(cursor.id)) {
                issues.push({ type: "lineage-cycle", ideaId: idea.id, clipId: start.id });
                break;
            }
            visited.add(cursor.id);
            cursor = cursor.parentClipId ? byId.get(cursor.parentClipId) : undefined;
        }
    }

    // Group assignments must point at an existing clip AND an existing group.
    const groupIds = new Set((idea.clipGroups ?? []).map((group) => group.id));
    for (const [clipId, groupId] of Object.entries(idea.clipGroupAssignments ?? {})) {
        if (!clipIds.has(clipId) || !groupIds.has(groupId)) {
            issues.push({ type: "dangling-group-assignment", ideaId: idea.id, clipId, groupId });
        }
    }

    // Project ideas with clips should have exactly one primary.
    if (idea.kind === "project" && idea.clips.length > 0) {
        const primaries = idea.clips.filter((clip) => clip.isPrimary).length;
        if (primaries === 0) issues.push({ type: "missing-primary", ideaId: idea.id });
        else if (primaries > 1) issues.push({ type: "multiple-primary", ideaId: idea.id, count: primaries });
    }
}

function checkPlaylists(workspaces: Workspace[], playlists: Playlist[], issues: IntegrityIssue[]) {
    const workspaceIds = new Set(workspaces.map((w) => w.id));
    const collectionIds = new Set(workspaces.flatMap((w) => w.collections.map((c) => c.id)));
    const ideaIds = new Set(workspaces.flatMap((w) => w.ideas.map((i) => i.id)));
    const clipIds = new Set(workspaces.flatMap((w) => w.ideas.flatMap((i) => i.clips.map((c) => c.id))));

    for (const playlist of playlists) {
        for (const item of playlist.items) {
            let reason: string | null = null;
            if (!workspaceIds.has(item.workspaceId)) reason = "missing workspace";
            else if (!collectionIds.has(item.collectionId)) reason = "missing collection";
            else if (!ideaIds.has(item.ideaId)) reason = "missing idea";
            else if (item.clipId && !clipIds.has(item.clipId)) reason = "missing clip";
            if (reason) {
                issues.push({ type: "dangling-playlist-item", playlistId: playlist.id, itemId: item.id, reason });
            }
        }
    }
}

async function checkFiles(workspaces: Workspace[], issues: IntegrityIssue[]) {
    const referenced = collectManagedAudioUrisFromWorkspaces(workspaces);

    // Missing files: every referenced managed audio file must exist on disk.
    for (const uri of referenced) {
        try {
            const info = await FileSystem.getInfoAsync(uri);
            if (!info.exists) {
                issues.push({ type: "missing-file", ref: "clip-audio", path: uri });
            }
        } catch {
            issues.push({ type: "missing-file", ref: "clip-audio", path: uri });
        }
    }

    // Orphan files: managed audio on disk that nothing references (overdub-aware via the
    // `referenced` set, which already includes stems + rendered mixes + source audio).
    try {
        const dirInfo = await FileSystem.getInfoAsync(SONG_SEED_AUDIO_DIR);
        if (dirInfo.exists) {
            const referencedNames = new Set(
                Array.from(referenced).map((uri) => uri.split("/").pop()).filter(Boolean) as string[]
            );
            const filenames = await FileSystem.readDirectoryAsync(SONG_SEED_AUDIO_DIR);
            for (const filename of filenames) {
                if (!referencedNames.has(filename)) {
                    issues.push({ type: "orphan-file", path: `${SONG_SEED_AUDIO_DIR}/${filename}` });
                }
            }
        }
    } catch {
        // Directory unreadable — nothing to report here.
    }
}

export async function scanLibraryIntegrity(
    workspaces: Workspace[],
    playlists: Playlist[]
): Promise<IntegrityReport> {
    const issues: IntegrityIssue[] = [];

    checkUniqueIds(workspaces, issues);
    for (const workspace of workspaces) {
        for (const idea of workspace.ideas) checkIdeaLineageAndGroups(idea, issues);
    }
    checkPlaylists(workspaces, playlists, issues);
    await checkFiles(workspaces, issues);

    let collections = 0;
    let ideas = 0;
    let clips = 0;
    for (const workspace of workspaces) {
        collections += workspace.collections.length;
        ideas += workspace.ideas.length;
        for (const idea of workspace.ideas) clips += idea.clips.length;
    }

    return {
        scannedAt: new Date().toISOString(),
        counts: { workspaces: workspaces.length, collections, ideas, clips },
        issues,
        ok: issues.length === 0,
    };
}

/** A short human-readable summary of a report, grouped by issue type. */
export function summarizeIntegrityReport(report: IntegrityReport): string {
    if (report.ok) {
        return `No problems found across ${report.counts.ideas} item${report.counts.ideas === 1 ? "" : "s"} and ${report.counts.clips} clip${report.counts.clips === 1 ? "" : "s"}.`;
    }
    const byType = new Map<string, number>();
    for (const issue of report.issues) byType.set(issue.type, (byType.get(issue.type) ?? 0) + 1);
    const labels: Record<IntegrityIssue["type"], string> = {
        "duplicate-id": "duplicate ID",
        "lineage-cycle": "lineage cycle",
        "dangling-parent": "broken parent link",
        "dangling-group-assignment": "broken group assignment",
        "missing-primary": "missing primary take",
        "multiple-primary": "multiple primary takes",
        "dangling-playlist-item": "broken playlist entry",
        "missing-file": "missing audio file",
        "orphan-file": "orphaned audio file",
    };
    return Array.from(byType.entries())
        .map(([type, count]) => `${count} ${labels[type as IntegrityIssue["type"]]}${count === 1 ? "" : "s"}`)
        .join(", ");
}
