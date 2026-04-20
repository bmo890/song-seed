import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { strFromU8, unzipSync } from "fflate";
import { createLyricsVersion, lyricsTextToDocument } from "../lyrics";
import { createEmptyProjectLyrics, createEmptyWorkspaceIdeasListState } from "../state/dataSlice";
import type {
    ClipVersion,
    Collection,
    Note,
    SongIdea,
    Workspace,
} from "../types";
import { SONG_SEED_AUDIO_DIR } from "./storagePaths";
import { MANAGED_WAVEFORM_PEAK_COUNT } from "./audioStorage";
import { buildStaticWaveform, ensureUniqueCountedTitle } from "../utils";
import type { SongSeedArchiveLibraryPreferences } from "./libraryExport";

type ArchiveClipManifest = {
    id: string;
    title: string;
    createdAt: number;
    isPrimary: boolean;
    isBookmarked?: boolean;
    parentClipId?: string;
    durationMs?: number;
    notes?: string;
    audioPath?: string;
    audioMissing?: boolean;
    overdub?: ArchiveClipOverdubManifest;
};

type ArchiveClipOverdubManifest = {
    root?: ArchiveClipOverdubRootManifest;
    renderedMixPath?: string;
    renderedMixDurationMs?: number;
    renderedMixWaveformPeaks?: number[];
    stems: ArchiveClipOverdubStemManifest[];
};

type ArchiveClipOverdubRootManifest = {
    gainDb: number;
    tonePreset: "neutral" | "low-cut" | "warm" | "bright";
};

type ArchiveClipOverdubStemManifest = {
    id: string;
    title: string;
    gainDb: number;
    offsetMs: number;
    tonePreset: "neutral" | "low-cut" | "warm" | "bright";
    isMuted: boolean;
    durationMs?: number;
    waveformPeaks?: number[];
    audioPath?: string;
    audioMissing?: boolean;
};

type ArchiveSongManifest = {
    id: string;
    title: string;
    folderPath: string;
    collectionId: string;
    createdAt: number;
    lastActivityAt: number;
    completionPct: number;
    isBookmarked: boolean;
    notes?: string;
    lyrics?: string;
    historyIncluded: boolean;
    clips: ArchiveClipManifest[];
};

type ArchiveCollectionManifest = {
    id: string;
    title: string;
    parentCollectionId?: string | null;
    folderPath: string;
    songs: ArchiveSongManifest[];
    standaloneClips: ArchiveClipManifest[];
};

type ArchiveWorkspaceManifest = {
    id: string;
    title: string;
    description?: string;
    isArchived?: boolean;
    folderPath: string;
    collections: ArchiveCollectionManifest[];
};

type ArchiveNotepadNoteManifest = {
    id: string;
    title: string;
    body: string;
    createdAt: number;
    updatedAt: number;
    isPinned: boolean;
};

type ArchiveManifest = {
    format: "song-seed-archive";
    schemaVersion: number;
    exportedAt: string;
    libraryPreferences?: SongSeedArchiveLibraryPreferences;
    scope: {
        workspaceIds: string[];
        collectionIds: string[];
        excludedCollectionIds?: string[];
    };
    warnings?: string[];
    summary: {
        workspaces: number;
        collections: number;
        songs: number;
        standaloneClips: number;
        notepadNotes?: number;
    };
    notepadNotes?: ArchiveNotepadNoteManifest[];
    workspaces: ArchiveWorkspaceManifest[];
};

export type PickedLibraryArchiveFile = {
    uri: string;
    name: string;
};

export type ParsedSongSeedArchive = {
    sourceUri: string;
    sourceName: string;
    manifest: ArchiveManifest;
    zipEntries: Record<string, Uint8Array>;
};

export type LibraryImportPreview = {
    archiveName: string;
    exportedAt: string;
    workspaceCount: number;
    collectionCount: number;
    songCount: number;
    standaloneClipCount: number;
    notepadNoteCount: number;
    workspaceTitles: string[];
    warningMessages: string[];
    primaryWorkspaceTitle: string | null;
};

export type MaterializedSongSeedArchiveMerge = {
    importedWorkspaces: Workspace[];
    importedNotes: Note[];
    suggestedPrimaryWorkspaceId: string | null;
    suggestedPrimaryCollectionIdByWorkspace: Record<string, string>;
    importedWorkspaceIds: string[];
    importedIdeaIds: string[];
    warnings: string[];
};

function buildEntityId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildWorkspaceId() {
    return buildEntityId("ws");
}

function buildCollectionId() {
    return buildEntityId("col");
}

function buildIdeaId() {
    return buildEntityId("idea");
}

function buildClipId() {
    return buildEntityId("clip");
}

function buildOverdubStemId() {
    return buildEntityId("stem");
}

function buildNoteId() {
    return buildEntityId("note");
}

function getPathExtension(path: string | undefined) {
    const match = path?.match(/\.([a-zA-Z0-9]+)$/);
    return match?.[1]?.toLowerCase() ?? "m4a";
}

function bytesToBase64(bytes: Uint8Array) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let output = "";

    for (let index = 0; index < bytes.length; index += 3) {
        const a = bytes[index] ?? 0;
        const b = bytes[index + 1] ?? 0;
        const c = bytes[index + 2] ?? 0;
        const chunk = (a << 16) | (b << 8) | c;

        output += alphabet[(chunk >> 18) & 0x3f];
        output += alphabet[(chunk >> 12) & 0x3f];
        output += index + 1 < bytes.length ? alphabet[(chunk >> 6) & 0x3f] : "=";
        output += index + 2 < bytes.length ? alphabet[chunk & 0x3f] : "=";
    }

    return output;
}

async function readFileBytes(fileUri: string) {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
    });

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
    let buffer = 0;
    let bits = 0;
    const output: number[] = [];

    for (const char of clean) {
        if (char === "=") break;
        const index = alphabet.indexOf(char);
        if (index < 0) continue;
        buffer = (buffer << 6) | index;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            output.push((buffer >> bits) & 0xff);
        }
    }

    return Uint8Array.from(output);
}

async function ensureAudioDirectory() {
    if (!FileSystem.documentDirectory) {
        throw new Error("Document directory unavailable.");
    }

    const info = await FileSystem.getInfoAsync(SONG_SEED_AUDIO_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(SONG_SEED_AUDIO_DIR, { intermediates: true });
    }
}

async function writeManagedArchiveAudio(targetId: string, extension: string, bytes: Uint8Array) {
    await ensureAudioDirectory();
    const destinationUri = `${SONG_SEED_AUDIO_DIR}/${targetId}.${extension}`;
    await FileSystem.writeAsStringAsync(destinationUri, bytesToBase64(bytes), {
        encoding: FileSystem.EncodingType.Base64,
    });
    return destinationUri;
}

async function materializeArchiveClipOverdub(
    overdubManifest: ArchiveClipOverdubManifest | undefined,
    parsed: ParsedSongSeedArchive,
    clipId: string,
    warnings: string[],
    clipLabel: string
) {
    if (!overdubManifest) {
        return undefined;
    }

    let renderedMixUri: string | undefined;
    if (overdubManifest.renderedMixPath) {
        const entryBytes = parsed.zipEntries[overdubManifest.renderedMixPath];
        if (entryBytes) {
            renderedMixUri = await writeManagedArchiveAudio(
                `${clipId}-mix`,
                getPathExtension(overdubManifest.renderedMixPath),
                entryBytes
            );
        } else {
            warnings.push(`Missing archived rendered overdub mix for ${clipLabel}.`);
        }
    }

    const stems = [];
    for (const stemManifest of overdubManifest.stems ?? []) {
        const stemId = buildOverdubStemId();
        let audioUri: string | undefined;
        if (stemManifest.audioPath) {
            const entryBytes = parsed.zipEntries[stemManifest.audioPath];
            if (entryBytes) {
                audioUri = await writeManagedArchiveAudio(
                    `${clipId}-${stemId}`,
                    getPathExtension(stemManifest.audioPath),
                    entryBytes
                );
            } else {
                warnings.push(`Missing archived overdub stem for ${clipLabel} / ${stemManifest.title}.`);
            }
        }

        stems.push({
            id: stemId,
            title: stemManifest.title,
            audioUri,
            gainDb: stemManifest.gainDb,
            offsetMs: stemManifest.offsetMs,
            tonePreset: stemManifest.tonePreset,
            isMuted: !!stemManifest.isMuted,
            durationMs: stemManifest.durationMs,
            waveformPeaks: stemManifest.waveformPeaks,
            createdAt: Date.now(),
        });
    }

    if (stems.length === 0 && !renderedMixUri) {
        return undefined;
    }

    return {
        root: overdubManifest.root
            ? {
                  gainDb: overdubManifest.root.gainDb,
                  tonePreset: overdubManifest.root.tonePreset,
              }
            : undefined,
        stems,
        renderedMixUri,
        renderedMixDurationMs: overdubManifest.renderedMixDurationMs,
        renderedMixWaveformPeaks: overdubManifest.renderedMixWaveformPeaks,
        lastRenderedAt: Date.now(),
    };
}

function isSongSeedArchiveManifest(value: unknown): value is ArchiveManifest {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ArchiveManifest>;
    return candidate.format === "song-seed-archive" && Array.isArray(candidate.workspaces);
}

export async function pickSongSeedArchiveFile(): Promise<PickedLibraryArchiveFile | null> {
    const result = await DocumentPicker.getDocumentAsync({
        type: ["application/zip", "application/x-zip-compressed", "*/*"],
        multiple: false,
        copyToCacheDirectory: true,
    });

    if (result.canceled || result.assets.length === 0) {
        return null;
    }

    const asset = result.assets[0]!;
    return {
        uri: asset.uri,
        name: asset.name || "Song Seed Archive.zip",
    };
}

export async function readSongSeedArchive(
    sourceUri: string,
    sourceName = sourceUri.split("/").pop() ?? "Song Seed Archive.zip"
): Promise<ParsedSongSeedArchive> {
    const zipBytes = await readFileBytes(sourceUri);
    const zipEntries = unzipSync(zipBytes);
    const manifestEntry = zipEntries["manifest.json"];
    if (!manifestEntry) {
        throw new Error("Archive is missing manifest.json.");
    }

    const manifestJson = JSON.parse(strFromU8(manifestEntry));
    if (!isSongSeedArchiveManifest(manifestJson)) {
        throw new Error("This file is not a valid Song Seed Archive.");
    }

    return {
        sourceUri,
        sourceName,
        manifest: manifestJson,
        zipEntries,
    };
}

export function buildLibraryImportPreview(parsed: ParsedSongSeedArchive): LibraryImportPreview {
    const primaryWorkspaceTitle =
        parsed.manifest.libraryPreferences?.primaryWorkspaceId
            ? parsed.manifest.workspaces.find(
                  (workspace) =>
                      workspace.id === parsed.manifest.libraryPreferences?.primaryWorkspaceId
              )?.title ?? null
            : null;

    return {
        archiveName: parsed.sourceName,
        exportedAt: parsed.manifest.exportedAt,
        workspaceCount: parsed.manifest.summary.workspaces,
        collectionCount: parsed.manifest.summary.collections,
        songCount: parsed.manifest.summary.songs,
        standaloneClipCount: parsed.manifest.summary.standaloneClips,
        notepadNoteCount: parsed.manifest.summary.notepadNotes ?? parsed.manifest.notepadNotes?.length ?? 0,
        workspaceTitles: parsed.manifest.workspaces.map((workspace) => workspace.title),
        warningMessages: parsed.manifest.warnings ?? [],
        primaryWorkspaceTitle,
    };
}

export async function materializeSongSeedArchiveMerge(
    parsed: ParsedSongSeedArchive,
    existingWorkspaces: Workspace[],
    localPrimaryWorkspaceId: string | null
): Promise<MaterializedSongSeedArchiveMerge> {
    const warnings = [...(parsed.manifest.warnings ?? [])];
    const importedWorkspaces: Workspace[] = [];
    const importedNotes: Note[] = [];
    const importedWorkspaceIds: string[] = [];
    const importedIdeaIds: string[] = [];
    const suggestedPrimaryCollectionIdByWorkspace: Record<string, string> = {};

    const existingWorkspaceTitles = existingWorkspaces.map((workspace) => workspace.title);
    const importedPrimaryWorkspaceSourceId = parsed.manifest.libraryPreferences?.primaryWorkspaceId ?? null;
    let suggestedPrimaryWorkspaceId: string | null = null;

    for (const noteManifest of parsed.manifest.notepadNotes ?? []) {
        importedNotes.push({
            id: buildNoteId(),
            title: noteManifest.title,
            body: noteManifest.body,
            createdAt: noteManifest.createdAt,
            updatedAt: noteManifest.updatedAt,
            isPinned: !!noteManifest.isPinned,
        });
    }

    for (const workspaceManifest of parsed.manifest.workspaces) {
        const workspaceId = buildWorkspaceId();
        const workspaceTitle = ensureUniqueCountedTitle(
            workspaceManifest.title,
            existingWorkspaceTitles
        );
        existingWorkspaceTitles.push(workspaceTitle);

        const collectionIdMap = new Map<string, string>();
        const clipIdMap = new Map<string, string>();
        const siblingTitlesByParent = new Map<string, string[]>();
        const collectionDrafts: Array<{
            sourceId: string;
            collectionId: string;
            title: string;
            parentSourceId: string | null;
        }> = [];
        const collections: Collection[] = [];
        const ideas: SongIdea[] = [];

        for (const collectionManifest of workspaceManifest.collections) {
            const parentKey = collectionManifest.parentCollectionId ?? "__root__";
            const siblingTitles = siblingTitlesByParent.get(parentKey) ?? [];
            const collectionTitle = ensureUniqueCountedTitle(collectionManifest.title, siblingTitles);
            siblingTitles.push(collectionTitle);
            siblingTitlesByParent.set(parentKey, siblingTitles);

            const collectionId = buildCollectionId();
            collectionIdMap.set(collectionManifest.id, collectionId);
            collectionDrafts.push({
                sourceId: collectionManifest.id,
                collectionId,
                title: collectionTitle,
                parentSourceId: collectionManifest.parentCollectionId ?? null,
            });
        }

        collectionDrafts.forEach((draft) => {
            collections.push({
                id: draft.collectionId,
                title: draft.title,
                workspaceId,
                parentCollectionId: draft.parentSourceId
                    ? collectionIdMap.get(draft.parentSourceId) ?? null
                    : null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                ideasListState: createEmptyWorkspaceIdeasListState(),
            });
        });

        for (const collectionManifest of workspaceManifest.collections) {
            const collectionId = collectionIdMap.get(collectionManifest.id);
            if (!collectionId) {
                continue;
            }

            for (const songManifest of collectionManifest.songs) {
                const ideaId = buildIdeaId();
                importedIdeaIds.push(ideaId);

                const clips: ClipVersion[] = [];
                for (const clipManifest of songManifest.clips) {
                    const clipId = buildClipId();
                    clipIdMap.set(clipManifest.id, clipId);
                    let audioUri: string | undefined;

                    if (clipManifest.audioPath) {
                        const entryBytes = parsed.zipEntries[clipManifest.audioPath];
                        if (entryBytes) {
                            audioUri = await writeManagedArchiveAudio(
                                clipId,
                                getPathExtension(clipManifest.audioPath),
                                entryBytes
                            );
                        } else {
                            warnings.push(`Missing archived audio for ${songManifest.title} / ${clipManifest.title}.`);
                        }
                    }

                    const overdub = await materializeArchiveClipOverdub(
                        clipManifest.overdub,
                        parsed,
                        clipId,
                        warnings,
                        `${songManifest.title} / ${clipManifest.title}`
                    );

                    clips.push({
                        id: clipId,
                        title: clipManifest.title,
                        notes: clipManifest.notes ?? "",
                        createdAt: clipManifest.createdAt,
                        isPrimary: clipManifest.isPrimary,
                        parentClipId: clipManifest.parentClipId ?? undefined,
                        audioUri,
                        durationMs: clipManifest.durationMs,
                        waveformPeaks: buildStaticWaveform(
                            `${clipId}-${clipManifest.title}`,
                            MANAGED_WAVEFORM_PEAK_COUNT
                        ),
                        overdub,
                    });
                }

                const remappedClips = clips.map((clip, index) => ({
                    ...clip,
                    parentClipId: clip.parentClipId ? clipIdMap.get(clip.parentClipId) : undefined,
                    isPrimary: clips.some((candidate) => candidate.isPrimary)
                        ? clip.isPrimary
                        : index === 0,
                }));

                ideas.push({
                    id: ideaId,
                    title: songManifest.title,
                    notes: songManifest.notes ?? "",
                    status: "song",
                    completionPct: songManifest.completionPct,
                    kind: "project",
                    collectionId,
                    clips: remappedClips,
                    lyrics: songManifest.lyrics
                        ? {
                              versions: [
                                  createLyricsVersion(
                                      lyricsTextToDocument(songManifest.lyrics)
                                  ),
                              ],
                          }
                        : createEmptyProjectLyrics(),
                    createdAt: songManifest.createdAt,
                    lastActivityAt: songManifest.lastActivityAt,
                    isBookmarked: !!songManifest.isBookmarked,
                });
            }

            for (const clipManifest of collectionManifest.standaloneClips) {
                const ideaId = buildIdeaId();
                const clipId = buildClipId();
                importedIdeaIds.push(ideaId);

                let audioUri: string | undefined;
                if (clipManifest.audioPath) {
                    const entryBytes = parsed.zipEntries[clipManifest.audioPath];
                    if (entryBytes) {
                        audioUri = await writeManagedArchiveAudio(
                            clipId,
                            getPathExtension(clipManifest.audioPath),
                            entryBytes
                        );
                    } else {
                        warnings.push(`Missing archived audio for ${clipManifest.title}.`);
                    }
                }

                const overdub = await materializeArchiveClipOverdub(
                    clipManifest.overdub,
                    parsed,
                    clipId,
                    warnings,
                    clipManifest.title
                );

                ideas.push({
                    id: ideaId,
                    title: clipManifest.title,
                    notes: clipManifest.notes ?? "",
                    status: "clip",
                    completionPct: 0,
                    kind: "clip",
                    collectionId,
                    clips: [
                        {
                            id: clipId,
                            title: clipManifest.title,
                            notes: clipManifest.notes ?? "",
                            createdAt: clipManifest.createdAt,
                            isPrimary: true,
                            audioUri,
                            durationMs: clipManifest.durationMs,
                            waveformPeaks: buildStaticWaveform(
                                `${clipId}-${clipManifest.title}`,
                                MANAGED_WAVEFORM_PEAK_COUNT
                            ),
                            overdub,
                        },
                    ],
                    createdAt: clipManifest.createdAt,
                    lastActivityAt: clipManifest.createdAt,
                    isBookmarked: !!clipManifest.isBookmarked,
                });
            }

            const importedPrimaryCollectionSourceId =
                parsed.manifest.libraryPreferences?.primaryCollectionIdByWorkspace?.[workspaceManifest.id];
            if (importedPrimaryCollectionSourceId === collectionManifest.id) {
                suggestedPrimaryCollectionIdByWorkspace[workspaceId] = collectionId;
            }
        }

        importedWorkspaceIds.push(workspaceId);
        importedWorkspaces.push({
            id: workspaceId,
            title: workspaceTitle,
            description: workspaceManifest.description,
            isArchived: false,
            collections,
            ideas,
        });

        if (!localPrimaryWorkspaceId && importedPrimaryWorkspaceSourceId === workspaceManifest.id) {
            suggestedPrimaryWorkspaceId = workspaceId;
        }
    }

    return {
        importedWorkspaces,
        importedNotes,
        suggestedPrimaryWorkspaceId,
        suggestedPrimaryCollectionIdByWorkspace,
        importedWorkspaceIds,
        importedIdeaIds,
        warnings,
    };
}
