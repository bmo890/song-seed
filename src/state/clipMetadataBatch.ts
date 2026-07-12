import type { Workspace } from "../types";

export type ClipMetadataEntry = {
    workspaceId: string;
    ideaId: string;
    clipId: string;
    durationMs?: number;
    waveformPeaks?: number[];
};

/**
 * Apply many clips' duration/peaks to the workspace tree in one pass, PRESERVING
 * object identity for everything not touched. Pure so it can be tested without the
 * store or the native audio surface.
 *
 * Reference identity is load-bearing: the sharded persist layer detects dirty
 * workspaces by object reference (planShardedWrite), so a blanket spread would mark
 * every shard dirty and make a multi-workspace library re-serialize its whole self
 * on every hydration write. Only workspaces/ideas/clips with a matching entry are
 * rebuilt; the rest are returned as-is.
 *
 * Placeholder-safety: an empty peaks array never overwrites existing peaks (a
 * skipped/preempted decode must not stamp a fake waveform over a real one).
 */
export function applyClipMetadataBatch(
    workspaces: Workspace[],
    entries: ClipMetadataEntry[]
): Workspace[] {
    const relevant = entries.filter((entry) => entry.durationMs || entry.waveformPeaks?.length);
    if (relevant.length === 0) return workspaces;

    // workspaceId -> ideaId -> clipId -> payload
    const byWorkspace = new Map<string, Map<string, Map<string, ClipMetadataEntry>>>();
    for (const entry of relevant) {
        let ideas = byWorkspace.get(entry.workspaceId);
        if (!ideas) {
            ideas = new Map();
            byWorkspace.set(entry.workspaceId, ideas);
        }
        let clips = ideas.get(entry.ideaId);
        if (!clips) {
            clips = new Map();
            ideas.set(entry.ideaId, clips);
        }
        clips.set(entry.clipId, entry);
    }

    return workspaces.map((workspace) => {
        const ideaMap = byWorkspace.get(workspace.id);
        if (!ideaMap) return workspace;
        return {
            ...workspace,
            ideas: workspace.ideas.map((idea) => {
                const clipMap = ideaMap.get(idea.id);
                if (!clipMap) return idea;
                return {
                    ...idea,
                    clips: idea.clips.map((clip) => {
                        const payload = clipMap.get(clip.id);
                        if (!payload) return clip;
                        return {
                            ...clip,
                            durationMs: payload.durationMs ?? clip.durationMs,
                            waveformPeaks: payload.waveformPeaks?.length
                                ? payload.waveformPeaks
                                : clip.waveformPeaks,
                        };
                    }),
                };
            }),
        };
    });
}
