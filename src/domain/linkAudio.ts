import type { ClipVersion, SongIdea, Workspace } from "../types";

/**
 * Audio that leaves the device through a SongNook Send link is compressed
 * (founder, 2026-10-14: "decent, doesn't need to be studio perfect"). The
 * library keeps its WAV; only the copy inside the parcel is AAC. This file is
 * the pure half: which files to encode, and how to point a workspace's clips
 * at the encoded copies so the archive builder needs no change at all.
 */

/** Containers that carry PCM and are worth encoding. Everything else (m4a,
 *  mp3, aac, ogg…) is already small and is packed as it is. */
const LOSSLESS_EXTENSIONS = new Set(["wav", "wave", "aif", "aiff", "aifc", "caf", "flac"]);

export function isLosslessAudioUri(uri: string | undefined): boolean {
    if (!uri) return false;
    const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return !!match && LOSSLESS_EXTENSIONS.has(match[1]!.toLowerCase());
}

/** Every audio URI a clip would put in a parcel: the take, its source, its
 *  layers and their rendered mix. */
export function clipAudioUris(clip: ClipVersion): string[] {
    const uris = [clip.audioUri, clip.sourceAudioUri, clip.overdub?.renderedMixUri];
    for (const stem of clip.overdub?.stems ?? []) uris.push(stem.audioUri);
    return uris.filter((uri): uri is string => !!uri);
}

/** The lossless audio among the files an archive build asked for, deduplicated,
 *  in archive order. `fileUris` are the build's file entries. */
export function losslessAudioToEncode(fileUris: Iterable<string | undefined>): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const uri of fileUris) {
        if (!uri || seen.has(uri) || !isLosslessAudioUri(uri)) continue;
        seen.add(uri);
        out.push(uri);
    }
    return out;
}

function substituteClip(clip: ClipVersion, encoded: ReadonlyMap<string, string>): ClipVersion {
    const audioUri = clip.audioUri && encoded.get(clip.audioUri);
    const sourceAudioUri = clip.sourceAudioUri && encoded.get(clip.sourceAudioUri);
    const mixUri = clip.overdub?.renderedMixUri && encoded.get(clip.overdub.renderedMixUri);
    const stems = clip.overdub?.stems.map((stem) => {
        const next = stem.audioUri ? encoded.get(stem.audioUri) : undefined;
        return next ? { ...stem, audioUri: next } : stem;
    });
    const stemsChanged = stems?.some((stem, index) => stem !== clip.overdub!.stems[index]);
    if (!audioUri && !sourceAudioUri && !mixUri && !stemsChanged) return clip;
    return {
        ...clip,
        ...(audioUri ? { audioUri } : null),
        ...(sourceAudioUri ? { sourceAudioUri } : null),
        ...(clip.overdub
            ? {
                  overdub: {
                      ...clip.overdub,
                      ...(mixUri ? { renderedMixUri: mixUri } : null),
                      ...(stemsChanged ? { stems: stems! } : null),
                  },
              }
            : null),
    };
}

function substituteIdea(idea: SongIdea, encoded: ReadonlyMap<string, string>): SongIdea {
    const clips = idea.clips.map((clip) => substituteClip(clip, encoded));
    return clips.some((clip, index) => clip !== idea.clips[index]) ? { ...idea, clips } : idea;
}

/**
 * The same workspaces with every encoded URI swapped in. Untouched objects are
 * returned as they are, so a workspace with nothing to encode is the same
 * reference. The archive builder derives every path and extension from these
 * URIs, so an encoded take is packed as `….m4a` with no further work.
 */
export function substituteEncodedAudio(workspaces: Workspace[], encoded: ReadonlyMap<string, string>): Workspace[] {
    if (encoded.size === 0) return workspaces;
    return workspaces.map((workspace) => {
        const ideas = workspace.ideas.map((idea) => substituteIdea(idea, encoded));
        return ideas.some((idea, index) => idea !== workspace.ideas[index]) ? { ...workspace, ideas } : workspace;
    });
}
