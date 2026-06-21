import type { ClipOverdubState, ClipVersion, SongIdea, Workspace } from "../types";
import { rebaseManagedUri, toRelativeManagedPath } from "../services/storagePaths";

/** Transforms a single managed audio URI. Returning the same string leaves it unchanged. */
type UriMapper = <T extends string | undefined | null>(uri: T) => T;

/**
 * Applies `mapUri` to every managed audio reference in the library — clip `audioUri`,
 * `sourceAudioUri`, overdub `renderedMixUri`, and each overdub stem's `audioUri` — and
 * only reallocates objects along paths whose URIs actually changed (so it's a cheap no-op
 * when nothing moves). Shared by hydration rebasing and backup relativization.
 */
export function mapWorkspacesManagedMedia(workspaces: Workspace[], mapUri: UriMapper): Workspace[] {
    let workspacesChanged = false;
    const nextWorkspaces = workspaces.map((workspace) => {
        let ideasChanged = false;
        const nextIdeas = workspace.ideas.map((idea) => {
            const nextIdea = mapIdeaManagedMedia(idea, mapUri);
            if (nextIdea !== idea) ideasChanged = true;
            return nextIdea;
        });

        // Archived workspaces hold their only copy of audio inside a managed package whose
        // path is also container-dependent — it must be healed/relativized too.
        let nextArchiveState = workspace.archiveState;
        if (workspace.archiveState?.archiveUri) {
            const mappedArchiveUri = mapUri(workspace.archiveState.archiveUri);
            if (mappedArchiveUri !== workspace.archiveState.archiveUri) {
                nextArchiveState = { ...workspace.archiveState, archiveUri: mappedArchiveUri };
            }
        }

        const archiveChanged = nextArchiveState !== workspace.archiveState;
        if (!ideasChanged && !archiveChanged) return workspace;
        workspacesChanged = true;
        return {
            ...workspace,
            ...(ideasChanged ? { ideas: nextIdeas } : null),
            ...(archiveChanged ? { archiveState: nextArchiveState } : null),
        };
    });
    return workspacesChanged ? nextWorkspaces : workspaces;
}

function mapIdeaManagedMedia(idea: SongIdea, mapUri: UriMapper): SongIdea {
    let clipsChanged = false;
    const nextClips = idea.clips.map((clip) => {
        const nextClip = mapClipManagedMedia(clip, mapUri);
        if (nextClip !== clip) clipsChanged = true;
        return nextClip;
    });
    if (!clipsChanged) return idea;
    return { ...idea, clips: nextClips };
}

function mapClipManagedMedia(clip: ClipVersion, mapUri: UriMapper): ClipVersion {
    const audioUri = mapUri(clip.audioUri);
    const sourceAudioUri = mapUri(clip.sourceAudioUri);
    const overdub = clip.overdub ? mapOverdubManagedMedia(clip.overdub, mapUri) : clip.overdub;

    if (
        audioUri === clip.audioUri &&
        sourceAudioUri === clip.sourceAudioUri &&
        overdub === clip.overdub
    ) {
        return clip;
    }
    return { ...clip, audioUri, sourceAudioUri, overdub };
}

function mapOverdubManagedMedia(overdub: ClipOverdubState, mapUri: UriMapper): ClipOverdubState {
    const renderedMixUri = mapUri(overdub.renderedMixUri);

    let stemsChanged = false;
    const nextStems = overdub.stems.map((stem) => {
        const stemAudioUri = mapUri(stem.audioUri);
        if (stemAudioUri === stem.audioUri) return stem;
        stemsChanged = true;
        return { ...stem, audioUri: stemAudioUri };
    });

    if (renderedMixUri === overdub.renderedMixUri && !stemsChanged) return overdub;
    return { ...overdub, renderedMixUri, stems: nextStems };
}

/**
 * Heals managed audio URIs against the live document directory so absolute paths that
 * embedded a stale container prefix (notably iOS after reinstall/restore) keep resolving.
 * No-op on Android and after normal updates. Runs on every hydration.
 */
export function rebaseWorkspacesManagedMedia(workspaces: Workspace[]): Workspace[] {
    return mapWorkspacesManagedMedia(workspaces, rebaseManagedUri);
}

/**
 * Rewrites managed audio URIs to their container-independent relative form
 * (e.g. `songseed/audio/<id>.m4a`) for storage in a backup snapshot, so the snapshot
 * is portable across installs/devices. Non-managed URIs are left untouched.
 */
export function toRelativeWorkspacesManagedMedia(workspaces: Workspace[]): Workspace[] {
    return mapWorkspacesManagedMedia(workspaces, ((uri) => toRelativeManagedPath(uri) ?? uri) as UriMapper);
}
