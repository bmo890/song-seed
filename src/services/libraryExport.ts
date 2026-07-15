import * as FileSystem from "expo-file-system/legacy";
import { getLatestLyricsText } from "../domain/lyrics";
import { getClipPlaybackUri } from "../domain/clipPresentation";
import { deriveNotePreviewTitle } from "../domain/notepad";
import type {
    BluetoothMonitoringCalibration,
    ClipVersion,
    Collection,
    Note,
    Setlist,
    Songbook,
    SongIdea,
    Workspace,
} from "../types";
import { getCollectionScopeIds } from "../utils";
import {
    buildTimestampSlug,
    ensureShareDirectory,
    getArchiveFileExtension,
    sanitizeArchiveSegment,
} from "./audioStorage";
import { createZipArchive, type ZipArchiveEntry } from "./zipArchive";
import { SONG_SEED_SHARE_DIR } from "./storagePaths";
import { cleanupShareTempFile } from "./managedMedia";
import { saveArchiveToUserLocation } from "./archiveSave";
import { ensureBackupDiskSpace } from "./backupOperation";
import type { BackupOperationOptions } from "./backupOperation";
import { recordLibraryOperationThroughput } from "./operationPacing";
import {
    LIBRARY_EXPORT_SCHEMA_VERSION,
    SONG_SEED_ARCHIVE_FORMAT,
    type ArchiveClipManifest,
    type ArchiveClipOverdubManifest,
    type ArchiveClipOverdubStemManifest,
    type ArchiveManifest,
    type ArchiveSongManifest,
    type ArchiveWorkspaceManifest,
    type ArchiveCollectionManifest,
} from "./libraryArchiveManifest";

// The archive manifest shape and the two option/preference types live in
// libraryArchiveManifest.ts so the importer and exporter share one definition. Re-exported here
// for existing importers that reach for them through libraryExport.
export type {
    SongSeedArchiveOptions,
    SongSeedArchiveLibraryPreferences,
} from "./libraryArchiveManifest";
import type {
    SongSeedArchiveOptions,
    SongSeedArchiveLibraryPreferences,
} from "./libraryArchiveManifest";

export type LibraryExportFormat = "songstead-archive" | "standard-zip";

export type LibraryExportScope = {
    workspaceIds: string[];
    collectionIds: string[];
    excludedCollectionIds?: string[];
};

export type StandardZipOptions = {
    includeNotesAsText: boolean;
    includeLyricsAsText: boolean;
    includeHiddenItems: boolean;
};

/** Progress + cancellation shared by both export formats (mirrors backups). */
type ExportProgressArgs = {
    onProgress?: BackupOperationOptions["onProgress"];
    signal?: AbortSignal;
};

export type ExportLibraryArgs =
    | ({
          workspaces: Workspace[];
          notes: Note[];
          format: "songstead-archive";
          scope: LibraryExportScope;
          options: SongSeedArchiveOptions;
          libraryPreferences?: SongSeedArchiveLibraryPreferences;
          songbooks?: Songbook[];
          setlists?: Setlist[];
          archiveLabel?: string;
      } & ExportProgressArgs)
    | ({
          workspaces: Workspace[];
          notes: Note[];
          format: "standard-zip";
          scope: LibraryExportScope;
          options: StandardZipOptions;
          archiveLabel?: string;
      } & ExportProgressArgs);

export type LibraryExportResult = {
    archiveUri: string;
    archiveTitle: string;
    warningMessages: string[];
    exportedWorkspaces: number;
    exportedCollections: number;
    exportedSongs: number;
    exportedStandaloneClips: number;
    exportedNotepadNotes: number;
    /** Android Storage Access Framework folder the archive was saved into, when applicable. */
    savedDirectoryUri?: string;
    /** True when the save destination is confirmed (Android folder copy); false for the iOS share sheet. */
    saveConfirmed?: boolean;
};

type StandardExportReport = {
    format: "standard-zip";
    exportedAt: string;
    options: StandardZipOptions;
    scope: LibraryExportScope;
    warnings: string[];
    summary: {
        workspaces: number;
        collections: number;
        songs: number;
        standaloneClips: number;
        notepadNotes: number;
    };
};

type ExportBuildContext = {
    directories: Set<string>;
    entries: ZipArchiveEntry[];
    warnings: string[];
    exportedWorkspaces: number;
    exportedCollections: number;
    exportedSongs: number;
    exportedStandaloneClips: number;
    exportedNotepadNotes: number;
};

export type LibraryExportEstimate = { fileCount: number; totalBytes: number };

/**
 * Cheap pre-run size estimate for the current selection — builds the entry list but
 * only stats the files, no packaging. Feeds the "512 MB · about a minute" copy shown
 * before generating an export.
 */
export async function estimateLibraryExportArchive(
    args: ExportLibraryArgs
): Promise<LibraryExportEstimate> {
    const build = args.format === "songstead-archive" ? buildSongSeedArchive(args) : buildStandardZip(args);
    let fileCount = 0;
    let totalBytes = 0;
    for (const entry of build.entries) {
        if (entry.fileUri) {
            const info = await FileSystem.getInfoAsync(entry.fileUri);
            if (info.exists && typeof info.size === "number" && info.size >= 0) {
                fileCount += 1;
                totalBytes += info.size;
            }
        } else if (typeof entry.data === "string") {
            totalBytes += entry.data.length;
        } else if (entry.data) {
            totalBytes += entry.data.length;
        }
    }
    return { fileCount, totalBytes };
}

export async function prepareLibraryExportArchive(args: ExportLibraryArgs): Promise<LibraryExportResult> {
    if (!FileSystem.documentDirectory) {
        throw new Error("Document directory unavailable.");
    }

    const build = args.format === "songstead-archive" ? buildSongSeedArchive(args) : buildStandardZip(args);

    await ensureShareDirectory();

    const archiveLabel =
        args.archiveLabel ??
        (args.format === "songstead-archive" ? "Songstead Archive" : "Songstead Export");
    const archiveTitle = `${sanitizeArchiveSegment(archiveLabel)} ${buildTimestampSlug()}`;
    const archiveUri = `${SONG_SEED_SHARE_DIR}/${archiveTitle}.zip`;

    let statedSourceBytes = 0;
    const validEntries = await Promise.all(
        build.entries.map(async (entry) => {
            if (!entry.fileUri) {
                return entry;
            }

            const info = await FileSystem.getInfoAsync(entry.fileUri);
            if (info.exists) {
                if (typeof info.size === "number" && info.size > 0) {
                    statedSourceBytes += info.size;
                    // Known size lets the zip writer stream single-pass (CRC patched in
                    // after streaming) with accurate progress totals from the first byte.
                    return { ...entry, sizeBytes: info.size };
                }
                return entry;
            }

            build.warnings.push(entry.missingMessage ?? `Missing file: ${entry.archiveName}`);
            return null;
        })
    );

    const filteredEntries = validEntries.filter((entry): entry is ZipArchiveEntry => entry != null);
    if (build.warnings.length > 0) {
        const warningReport = JSON.stringify(
            {
                format: args.format,
                exportedAt: new Date().toISOString(),
                scope: args.scope,
                warnings: build.warnings,
                summary: {
                    workspaces: build.exportedWorkspaces,
                    collections: build.exportedCollections,
                    songs: build.exportedSongs,
                    standaloneClips: build.exportedStandaloneClips,
                    notepadNotes: build.exportedNotepadNotes,
                },
            },
            null,
            2
        );
        const existingReportIndex = filteredEntries.findIndex((entry) => entry.archiveName === "export-report.json");
        if (existingReportIndex >= 0) {
            filteredEntries[existingReportIndex] = { archiveName: "export-report.json", data: warningReport };
        } else {
            filteredEntries.push({ archiveName: "export-report.json", data: warningReport });
        }
    }

    const zipEntries: ZipArchiveEntry[] = [
        ...Array.from(build.directories)
            .sort((a, b) => a.localeCompare(b))
            .map((archiveName) => ({ archiveName, directory: true })),
        ...filteredEntries,
    ];

    if (zipEntries.length === 0) {
        throw new Error("Nothing to export for the current selection.");
    }

    const fileEntryCount = zipEntries.filter((entry) => !!entry.fileUri).length;
    // Fail early with a friendly storage message instead of a raw native write error
    // partway through packaging (mirrors the disaster-recovery backup guard).
    await ensureBackupDiskSpace(statedSourceBytes, "export your library");
    console.log(`[export] packaging ${fileEntryCount} file(s) into ${args.format} archive…`);
    const packStartedAt = Date.now();
    await createZipArchive(archiveUri, zipEntries, {
        onProgress: args.onProgress,
        signal: args.signal,
    });
    const packMs = Date.now() - packStartedAt;
    console.log(`[export] packaging done in ${(packMs / 1000).toFixed(1)}s`);
    recordLibraryOperationThroughput("export", statedSourceBytes, packMs);

    return {
        archiveUri,
        archiveTitle,
        warningMessages: build.warnings,
        exportedWorkspaces: build.exportedWorkspaces,
        exportedCollections: build.exportedCollections,
        exportedSongs: build.exportedSongs,
        exportedStandaloneClips: build.exportedStandaloneClips,
        exportedNotepadNotes: build.exportedNotepadNotes,
    };
}

export async function exportLibrary(args: ExportLibraryArgs): Promise<LibraryExportResult> {
    const prepared = await prepareLibraryExportArchive(args);

    try {
        // Save through the same crash-safe path as backups: an Android folder copy we await
        // (no Intent-share race) or the iOS share sheet. Only after the save returns do we
        // delete the temporary archive in `finally`.
        const saved = await saveArchiveToUserLocation(prepared.archiveUri, `${prepared.archiveTitle}.zip`);
        return {
            ...prepared,
            savedDirectoryUri: saved.savedDirectoryUri,
            saveConfirmed: saved.saveConfirmed,
        };
    } finally {
        await cleanupShareTempFile(prepared.archiveUri);
    }
}

// Keys dropped from the per-song readable summary (kept in full in the root manifest.json).
const READABLE_SUMMARY_OMITTED_KEYS = new Set([
    "waveformPeaks",
    "renderedMixWaveformPeaks",
    "lyricsVersions",
    "chordPalette",
    "chordSheet",
    "sections",
    "practiceMarkers",
    "editRegions",
    "analysis",
]);

function readableSummaryReplacer(key: string, value: unknown) {
    return READABLE_SUMMARY_OMITTED_KEYS.has(key) ? undefined : value;
}

/**
 * Estimate the archive byte size for both fidelity modes so the export UI can show the cost of
 * "preserve all metadata" before the user commits. Builds the entry list in memory (no zip
 * write) and sums metadata JSON + each referenced audio file's on-disk size. The audio is
 * identical in both modes; the difference is the extra metadata in full fidelity. The figure is
 * an upper-ish estimate — the real archive is deflate-compressed — but good enough to decide.
 */
export async function estimateLibraryArchiveSizes(
    args: Extract<ExportLibraryArgs, { format: "songstead-archive" }>
): Promise<{ standardBytes: number; fullBytes: number }> {
    const encoder = new TextEncoder();
    const fileSizeCache = new Map<string, number>();

    const measure = async (context: ExportBuildContext): Promise<number> => {
        let total = 0;
        for (const entry of context.entries) {
            if (entry.directory) continue;
            if (typeof entry.data === "string") {
                total += encoder.encode(entry.data).length;
            } else if (entry.fileUri) {
                let size = fileSizeCache.get(entry.fileUri);
                if (size == null) {
                    try {
                        const info = await FileSystem.getInfoAsync(entry.fileUri);
                        size = info.exists && typeof info.size === "number" ? info.size : 0;
                    } catch {
                        size = 0;
                    }
                    fileSizeCache.set(entry.fileUri, size);
                }
                total += size;
            }
        }
        return total;
    };

    const standard = buildSongSeedArchive({
        ...args,
        options: { ...args.options, preserveAllMetadata: false },
    });
    const full = buildSongSeedArchive({
        ...args,
        options: { ...args.options, preserveAllMetadata: true },
    });
    return { standardBytes: await measure(standard), fullBytes: await measure(full) };
}

function buildSongSeedArchive(args: Extract<ExportLibraryArgs, { format: "songstead-archive" }>): ExportBuildContext {
    const context = createExportBuildContext();
    const selectedWorkspaces = getSelectedWorkspaces(args.workspaces, args.scope);
    const folderAllocator = createFolderAllocator();
    const collectionFolderPaths = new Map<string, string>();
    const preserveAllMetadata = args.options.preserveAllMetadata;
    const manifest: ArchiveManifest = {
        format: SONG_SEED_ARCHIVE_FORMAT,
        schemaVersion: LIBRARY_EXPORT_SCHEMA_VERSION,
        fidelity: preserveAllMetadata ? "full" : "standard",
        exportedAt: new Date().toISOString(),
        options: args.options,
        libraryPreferences: buildExportedLibraryPreferences(
            selectedWorkspaces.map(({ workspace, selectedCollectionIds }) => ({
                workspace,
                selectedCollectionIds,
            })),
            args.libraryPreferences
        ),
        scope: args.scope,
        warnings: context.warnings,
        summary: {
            workspaces: 0,
            collections: 0,
            songs: 0,
            standaloneClips: 0,
            notepadNotes: 0,
        },
        notepadNotes: [],
        workspaces: [],
    };

    if (preserveAllMetadata) {
        if (args.songbooks?.length) manifest.songbooks = args.songbooks;
        if (args.setlists?.length) manifest.setlists = args.setlists;
    }

    if (args.options.includeNotes && args.notes.length > 0) {
        const notepadFolderPath = "Notepad";
        addDirectory(context, notepadFolderPath);
        const noteAllocator = createFolderAllocator();

        args.notes
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .forEach((note) => {
                const noteTitle = deriveNotePreviewTitle(note);
                const noteStemPath = allocateChildPath(
                    notepadFolderPath,
                    noteTitle,
                    noteAllocator,
                    "Note"
                );

                (manifest.notepadNotes ??= []).push({
                    id: note.id,
                    title: note.title,
                    body: note.body,
                    createdAt: note.createdAt,
                    updatedAt: note.updatedAt,
                    isPinned: note.isPinned,
                });
                context.exportedNotepadNotes += 1;
                addTextEntry(context, `${noteStemPath}.txt`, note.body.trim() || noteTitle);
            });
    }

    selectedWorkspaces.forEach(({ workspace, selectedCollectionIds }) => {
        const workspaceFolderPath = allocateChildPath("", workspace.title, folderAllocator, "Workspace");
        addDirectory(context, workspaceFolderPath);
        context.exportedWorkspaces += 1;

        const selectedCollections = workspace.collections.filter((collection) => selectedCollectionIds.has(collection.id));
        const workspaceManifest: ArchiveWorkspaceManifest = {
            id: workspace.id,
            title: workspace.title,
            description: workspace.description,
            isArchived: workspace.isArchived,
            folderPath: workspaceFolderPath,
            collections: [],
            ...(preserveAllMetadata
                ? { color: workspace.color, avatarKey: workspace.avatarKey }
                : null),
        };

        assignCollectionFolderPaths(workspace, workspaceFolderPath, folderAllocator, collectionFolderPaths);

        selectedCollections.forEach((collection) => {
            const collectionFolderPath = collectionFolderPaths.get(collection.id);
            if (!collectionFolderPath) {
                return;
            }

            addDirectory(context, collectionFolderPath);
            context.exportedCollections += 1;

            const collectionManifest: ArchiveCollectionManifest = {
                id: collection.id,
                title: collection.title,
                parentCollectionId: collection.parentCollectionId ?? null,
                folderPath: collectionFolderPath,
                songs: [],
                standaloneClips: [],
                ...(preserveAllMetadata
                    ? {
                          description: collection.description,
                          createdAt: collection.createdAt,
                          updatedAt: collection.updatedAt,
                      }
                    : null),
            };

            const itemFolderAllocator = createFolderAllocator();
            const ideas = workspace.ideas.filter((idea) => idea.collectionId === collection.id);
            ideas.forEach((idea) => {
                if (!args.options.includeHiddenItems && isIdeaHidden(workspace, collection, idea)) {
                    return;
                }

                if (idea.kind === "project") {
                    const songFolderPath = allocateChildPath(
                        collectionFolderPath,
                        idea.title,
                        itemFolderAllocator,
                        "Song"
                    );
                    addDirectory(context, songFolderPath);
                    context.exportedSongs += 1;

                    const songManifest = buildArchiveSongManifest(idea, songFolderPath, args.options, context);
                    collectionManifest.songs.push(songManifest);
                    // song.json is a human-readable summary; the heavy machine-only fields
                    // (waveforms, markers, sections, analysis, lyric versions) live once in the
                    // root manifest.json that import reads, so strip them here to avoid bloat.
                    addTextEntry(
                        context,
                        `${songFolderPath}/song.json`,
                        JSON.stringify(songManifest, readableSummaryReplacer, 2)
                    );
                } else {
                    const clipManifest = buildArchiveStandaloneClip(
                        idea,
                        collectionFolderPath,
                        itemFolderAllocator,
                        args.options,
                        context
                    );
                    collectionManifest.standaloneClips.push(clipManifest);
                    context.exportedStandaloneClips += 1;
                }
            });

            workspaceManifest.collections.push(collectionManifest);
        });

        manifest.workspaces.push(workspaceManifest);
    });

    manifest.summary = {
        workspaces: context.exportedWorkspaces,
        collections: context.exportedCollections,
        songs: context.exportedSongs,
        standaloneClips: context.exportedStandaloneClips,
        notepadNotes: context.exportedNotepadNotes,
    };

    addTextEntry(context, "manifest.json", JSON.stringify(manifest, null, 2));

    return context;
}

function buildStandardZip(args: Extract<ExportLibraryArgs, { format: "standard-zip" }>): ExportBuildContext {
    const context = createExportBuildContext();
    const selectedWorkspaces = getSelectedWorkspaces(args.workspaces, args.scope);
    const folderAllocator = createFolderAllocator();
    const collectionFolderPaths = new Map<string, string>();

    selectedWorkspaces.forEach(({ workspace, selectedCollectionIds }) => {
        const workspaceFolderPath = allocateChildPath("", workspace.title, folderAllocator, "Workspace");
        addDirectory(context, workspaceFolderPath);
        context.exportedWorkspaces += 1;

        assignCollectionFolderPaths(workspace, workspaceFolderPath, folderAllocator, collectionFolderPaths);

        workspace.collections
            .filter((collection) => selectedCollectionIds.has(collection.id))
            .forEach((collection) => {
                const collectionFolderPath = collectionFolderPaths.get(collection.id);
                if (!collectionFolderPath) {
                    return;
                }

                addDirectory(context, collectionFolderPath);
                context.exportedCollections += 1;

                const fileAllocator = createFolderAllocator();
                const ideas = workspace.ideas.filter((idea) => idea.collectionId === collection.id);
                ideas.forEach((idea) => {
                    if (!args.options.includeHiddenItems && isIdeaHidden(workspace, collection, idea)) {
                        return;
                    }

                    const itemStem = allocateChildPath(collectionFolderPath, idea.title, fileAllocator, "Item");

                    if (idea.kind === "project") {
                        context.exportedSongs += 1;
                        exportStandardSong(idea, itemStem, args.options, context);
                        return;
                    }

                    context.exportedStandaloneClips += 1;
                    exportStandardClip(idea, itemStem, args.options, context);
                });
            });
    });

    if (args.options.includeNotesAsText && args.notes.length > 0) {
        const notepadFolderPath = "Notepad";
        addDirectory(context, notepadFolderPath);
        const noteAllocator = createFolderAllocator();

        args.notes
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .forEach((note) => {
                const noteTitle = deriveNotePreviewTitle(note);
                const noteStemPath = allocateChildPath(
                    notepadFolderPath,
                    noteTitle,
                    noteAllocator,
                    "Note"
                );
                context.exportedNotepadNotes += 1;
                addTextEntry(context, `${noteStemPath}.txt`, note.body.trim() || noteTitle);
            });
    }

    const report: StandardExportReport = {
        format: "standard-zip",
        exportedAt: new Date().toISOString(),
        options: args.options,
        scope: args.scope,
        warnings: context.warnings,
        summary: {
            workspaces: context.exportedWorkspaces,
            collections: context.exportedCollections,
            songs: context.exportedSongs,
            standaloneClips: context.exportedStandaloneClips,
            notepadNotes: context.exportedNotepadNotes,
        },
    };

    if (context.warnings.length > 0) {
        addTextEntry(context, "export-report.json", JSON.stringify(report, null, 2));
    }

    return context;
}

/**
 * Attach every persisted clip field to the manifest (full-fidelity export only). Undefined
 * fields are dropped by JSON.stringify, so absent metadata stays absent on the round-trip.
 * `isBookmarked` is handled by the caller because standalone clips reuse it for the idea's
 * bookmark, so it must not be blindly overwritten with the clip's own value here.
 */
function applyFullClipMetadata(manifest: ArchiveClipManifest, clip: ClipVersion): void {
    manifest.isTitleAutoGenerated = clip.isTitleAutoGenerated;
    manifest.importedAt = clip.importedAt;
    manifest.sourceCreatedAt = clip.sourceCreatedAt;
    manifest.parentAssignedAt = clip.parentAssignedAt;
    manifest.waveformPeaks = clip.waveformPeaks;
    manifest.editRegions = clip.editRegions;
    manifest.tags = clip.tags;
    manifest.practiceMarkers = clip.practiceMarkers;
    manifest.sections = clip.sections;
    manifest.analysis = clip.analysis;
    manifest.manualSortOrder = clip.manualSortOrder;
}

/** Attach project-level fields the standard archive drops (full-fidelity export only). */
function applyFullSongMetadata(manifest: ArchiveSongManifest, idea: SongIdea): void {
    manifest.status = idea.status;
    manifest.isDraft = idea.isDraft;
    manifest.importedAt = idea.importedAt;
    manifest.sourceCreatedAt = idea.sourceCreatedAt;
    manifest.customTags = idea.customTags;
    manifest.clipGroups = idea.clipGroups;
    manifest.clipGroupAssignments = idea.clipGroupAssignments;
    manifest.chordPalette = idea.chordPalette;
    manifest.chordSheet = idea.chordSheet;
}

function buildArchiveSongManifest(
    idea: SongIdea,
    songFolderPath: string,
    options: SongSeedArchiveOptions,
    context: ExportBuildContext
): ArchiveSongManifest {
    const clipAllocator = createFolderAllocator();
    const primaryClip = getPrimaryClip(idea);
    const clipsToExport = options.includeFullSongHistory ? idea.clips : primaryClip ? [primaryClip] : [];
    const songManifest: ArchiveSongManifest = {
        id: idea.id,
        title: idea.title,
        folderPath: songFolderPath,
        collectionId: idea.collectionId,
        createdAt: idea.createdAt,
        lastActivityAt: idea.lastActivityAt,
        completionPct: idea.completionPct,
        isBookmarked: !!idea.isBookmarked,
        historyIncluded: options.includeFullSongHistory,
        clips: [],
    };

    if (options.preserveAllMetadata) {
        applyFullSongMetadata(songManifest, idea);
    }

    if (options.includeNotes && idea.notes.trim().length > 0) {
        songManifest.notes = idea.notes;
        addTextEntry(context, `${songFolderPath}/Notes.txt`, idea.notes);
    }

    const lyricsText = options.includeLyrics ? getLatestLyricsText(idea).trim() : "";
    if (lyricsText) {
        songManifest.lyrics = lyricsText;
        addTextEntry(context, `${songFolderPath}/Lyrics.txt`, lyricsText);
    }
    // Full fidelity keeps every lyric version (with chords); the .txt above stays human-readable.
    if (options.preserveAllMetadata && options.includeLyrics && idea.lyrics?.versions?.length) {
        songManifest.lyricsVersions = idea.lyrics.versions;
    }

    clipsToExport.forEach((clip) => {
        const clipAudioUri = getArchiveRootClipAudioUri(clip);
        const clipStemPath = allocateChildPath(songFolderPath, clip.title || idea.title, clipAllocator, "Clip");
        const clipManifest: ArchiveClipManifest = {
            id: clip.id,
            title: clip.title,
            createdAt: clip.createdAt,
            isPrimary: clip.isPrimary,
            parentClipId: clip.parentClipId,
            durationMs: clip.durationMs,
            recordingGrid: clip.recordingGrid,
        };

        if (options.includeNotes && clip.notes.trim().length > 0) {
            clipManifest.notes = clip.notes;
            addTextEntry(context, `${clipStemPath} Notes.txt`, clip.notes);
        }

        if (clipAudioUri) {
            const audioPath = `${clipStemPath}.${getArchiveFileExtension(clipAudioUri)}`;
            clipManifest.audioPath = audioPath;
            addFileEntry(context, audioPath, clipAudioUri, `Missing clip audio for ${idea.title} / ${clip.title || clip.id}.`);
        } else {
            clipManifest.audioMissing = true;
            context.warnings.push(`Missing clip audio for ${idea.title} / ${clip.title || clip.id}.`);
        }

        const overdubManifest = buildArchiveClipOverdubManifest(
            clip,
            clipStemPath,
            context,
            `${idea.title} / ${clip.title || clip.id}`
        );
        if (overdubManifest) {
            clipManifest.overdub = overdubManifest;
        }

        if (options.preserveAllMetadata) {
            applyFullClipMetadata(clipManifest, clip);
            clipManifest.isBookmarked = clip.isBookmarked;
        }

        songManifest.clips.push(clipManifest);
    });

    return songManifest;
}

function buildArchiveStandaloneClip(
    idea: SongIdea,
    collectionFolderPath: string,
    itemAllocator: FolderAllocator,
    options: SongSeedArchiveOptions,
    context: ExportBuildContext
): ArchiveClipManifest {
    const primaryClip = getPrimaryClip(idea);
    const clipAudioUri = primaryClip ? getArchiveRootClipAudioUri(primaryClip) : undefined;
    const clipStemPath = allocateChildPath(collectionFolderPath, idea.title, itemAllocator, "Clip");
    const clipManifest: ArchiveClipManifest = {
        id: idea.id,
        title: idea.title,
        createdAt: idea.createdAt,
        isPrimary: true,
        isBookmarked: !!idea.isBookmarked,
        durationMs: primaryClip?.durationMs,
        recordingGrid: primaryClip?.recordingGrid,
    };

    if (options.includeNotes && idea.notes.trim().length > 0) {
        clipManifest.notes = idea.notes;
        addTextEntry(context, `${clipStemPath} Notes.txt`, idea.notes);
    }

    if (clipAudioUri) {
        const audioPath = `${clipStemPath}.${getArchiveFileExtension(clipAudioUri)}`;
        clipManifest.audioPath = audioPath;
        addFileEntry(context, audioPath, clipAudioUri, `Missing clip audio for ${idea.title}.`);
    } else {
        clipManifest.audioMissing = true;
        context.warnings.push(`Missing clip audio for ${idea.title}.`);
    }

    if (primaryClip) {
        const overdubManifest = buildArchiveClipOverdubManifest(
            primaryClip,
            clipStemPath,
            context,
            idea.title
        );
        if (overdubManifest) {
            clipManifest.overdub = overdubManifest;
        }

        // Preserve the clip's creative metadata; isBookmarked already carries the idea's bookmark.
        if (options.preserveAllMetadata) {
            applyFullClipMetadata(clipManifest, primaryClip);
        }
    }

    return clipManifest;
}

function exportStandardSong(
    idea: SongIdea,
    itemStemPath: string,
    options: StandardZipOptions,
    context: ExportBuildContext
) {
    const primaryClip = getPrimaryClip(idea);
    const primaryAudioUri = primaryClip ? getStandardExportAudioUri(primaryClip) : undefined;

    if (primaryAudioUri) {
        addFileEntry(
            context,
            `${itemStemPath}.${getArchiveFileExtension(primaryAudioUri)}`,
            primaryAudioUri,
            `Missing primary take for ${idea.title}.`
        );
    } else {
        context.warnings.push(`Missing primary take for ${idea.title}.`);
    }

    if (options.includeNotesAsText && idea.notes.trim().length > 0) {
        addTextEntry(context, `${itemStemPath} Notes.txt`, idea.notes);
    }

    const lyricsText = options.includeLyricsAsText ? getLatestLyricsText(idea).trim() : "";
    if (lyricsText) {
        addTextEntry(context, `${itemStemPath} Lyrics.txt`, lyricsText);
    }
}

function exportStandardClip(
    idea: SongIdea,
    itemStemPath: string,
    options: StandardZipOptions,
    context: ExportBuildContext
) {
    const primaryClip = getPrimaryClip(idea);
    const audioUri = primaryClip ? getStandardExportAudioUri(primaryClip) : undefined;

    if (audioUri) {
        addFileEntry(
            context,
            `${itemStemPath}.${getArchiveFileExtension(audioUri)}`,
            audioUri,
            `Missing clip audio for ${idea.title}.`
        );
    } else {
        context.warnings.push(`Missing clip audio for ${idea.title}.`);
    }

    if (options.includeNotesAsText && idea.notes.trim().length > 0) {
        addTextEntry(context, `${itemStemPath} Notes.txt`, idea.notes);
    }
}

function buildExportedLibraryPreferences(
    selectedWorkspaces: Array<{ workspace: Workspace; selectedCollectionIds: Set<string> }>,
    libraryPreferences?: SongSeedArchiveLibraryPreferences
): SongSeedArchiveLibraryPreferences {
    if (!libraryPreferences) {
        return {
            primaryWorkspaceId: null,
            primaryCollectionIdByWorkspace: {},
            bluetoothMonitoringCalibrations: [],
        };
    }

    const selectedWorkspaceIds = new Set(selectedWorkspaces.map(({ workspace }) => workspace.id));
    const primaryCollectionIdByWorkspace = Object.fromEntries(
        selectedWorkspaces.flatMap(({ workspace, selectedCollectionIds }) => {
            const primaryCollectionId = libraryPreferences.primaryCollectionIdByWorkspace[workspace.id];
            if (!primaryCollectionId || !selectedCollectionIds.has(primaryCollectionId)) {
                return [];
            }
            return [[workspace.id, primaryCollectionId] as const];
        })
    );

    return {
        primaryWorkspaceId:
            libraryPreferences.primaryWorkspaceId &&
            selectedWorkspaceIds.has(libraryPreferences.primaryWorkspaceId)
                ? libraryPreferences.primaryWorkspaceId
                : null,
        primaryCollectionIdByWorkspace,
        bluetoothMonitoringCalibrations: libraryPreferences.bluetoothMonitoringCalibrations ?? [],
    };
}

function getSelectedWorkspaces(workspaces: Workspace[], scope: LibraryExportScope) {
    const workspaceIds = new Set(scope.workspaceIds);
    const explicitCollectionIds = new Set(scope.collectionIds);
    const excludedCollectionIds = new Set(scope.excludedCollectionIds ?? []);

    return workspaces.flatMap((workspace) => {
        const selectedCollectionIds = new Set<string>();

        if (workspaceIds.has(workspace.id)) {
            workspace.collections.forEach((collection) => selectedCollectionIds.add(collection.id));
        }

        workspace.collections.forEach((collection) => {
            if (!explicitCollectionIds.has(collection.id)) {
                return;
            }

            getCollectionScopeIds(workspace, collection.id).forEach((id) => selectedCollectionIds.add(id));
        });

        workspace.collections.forEach((collection) => {
            if (!excludedCollectionIds.has(collection.id)) {
                return;
            }

            getCollectionScopeIds(workspace, collection.id).forEach((id) => selectedCollectionIds.delete(id));
        });

        if (!workspaceIds.has(workspace.id) && selectedCollectionIds.size === 0) {
            return [];
        }

        return [{ workspace, selectedCollectionIds }];
    });
}

type FolderAllocator = Map<string, Set<string>>;

function createFolderAllocator(): FolderAllocator {
    return new Map<string, Set<string>>();
}

function allocateChildPath(parentPath: string, label: string, allocator: FolderAllocator, fallback: string) {
    const registryKey = parentPath || "/";
    const usedNames = allocator.get(registryKey) ?? new Set<string>();
    allocator.set(registryKey, usedNames);

    const baseSegment = sanitizeArchiveSegment(label || fallback);
    let segment = baseSegment;
    let suffix = 2;

    while (usedNames.has(segment.toLowerCase())) {
        segment = `${baseSegment} ${suffix}`;
        suffix += 1;
    }

    usedNames.add(segment.toLowerCase());
    return parentPath ? `${parentPath}/${segment}` : segment;
}

function assignCollectionFolderPaths(
    workspace: Workspace,
    workspaceFolderPath: string,
    allocator: FolderAllocator,
    output: Map<string, string>
) {
    const walk = (parentCollectionId: string | null, parentPath: string) => {
        workspace.collections
            .filter((collection) => (collection.parentCollectionId ?? null) === parentCollectionId)
            .forEach((collection) => {
                const collectionPath = allocateChildPath(parentPath, collection.title, allocator, "Collection");
                output.set(collection.id, collectionPath);
                walk(collection.id, collectionPath);
            });
    };

    walk(null, workspaceFolderPath);
}

function createExportBuildContext(): ExportBuildContext {
    return {
        directories: new Set<string>(),
        entries: [],
        warnings: [],
        exportedWorkspaces: 0,
        exportedCollections: 0,
        exportedSongs: 0,
        exportedStandaloneClips: 0,
        exportedNotepadNotes: 0,
    };
}

function addDirectory(context: ExportBuildContext, directoryPath: string) {
    const segments = directoryPath.split("/").filter(Boolean);
    let currentPath = "";

    segments.forEach((segment) => {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        context.directories.add(currentPath);
    });
}

function addTextEntry(context: ExportBuildContext, archiveName: string, data: string) {
    const parentDirectory = getParentDirectory(archiveName);
    if (parentDirectory) {
        addDirectory(context, parentDirectory);
    }

    context.entries.push({ archiveName, data });
}

function addFileEntry(context: ExportBuildContext, archiveName: string, fileUri: string, missingMessage: string) {
    const parentDirectory = getParentDirectory(archiveName);
    if (parentDirectory) {
        addDirectory(context, parentDirectory);
    }

    context.entries.push({ archiveName, fileUri, missingMessage });
}

function getParentDirectory(path: string) {
    const index = path.lastIndexOf("/");
    return index >= 0 ? path.slice(0, index) : "";
}

function isIdeaHidden(workspace: Workspace, collection: Collection, idea: SongIdea) {
    if (collection.ideasListState.hiddenIdeaIds.includes(idea.id)) {
        return true;
    }

    return workspace.ideasListState?.hiddenIdeaIds?.includes(idea.id) ?? false;
}

function getPrimaryClip(idea: SongIdea) {
    return idea.clips.find((clip) => clip.isPrimary) ?? idea.clips[0] ?? null;
}

function getArchiveRootClipAudioUri(clip: ClipVersion) {
    return clip.audioUri ?? clip.sourceAudioUri;
}

function getStandardExportAudioUri(clip: ClipVersion) {
    return getClipPlaybackUri(clip) ?? clip.sourceAudioUri;
}

function buildArchiveClipOverdubManifest(
    clip: ClipVersion,
    clipStemPath: string,
    context: ExportBuildContext,
    clipLabel: string
): ArchiveClipOverdubManifest | undefined {
    const stems = clip.overdub?.stems ?? [];
    const renderedMixUri = clip.overdub?.renderedMixUri;
    if (stems.length === 0 && !renderedMixUri) {
        return undefined;
    }

    const overdubManifest: ArchiveClipOverdubManifest = {
        root: clip.overdub?.root
            ? {
                  gainDb: clip.overdub.root.gainDb,
                  tonePreset: clip.overdub.root.tonePreset,
              }
            : undefined,
        renderedMixDurationMs: clip.overdub?.renderedMixDurationMs,
        renderedMixWaveformPeaks: clip.overdub?.renderedMixWaveformPeaks,
        stems: [],
    };

    if (renderedMixUri) {
        const renderedMixPath = `${clipStemPath} Mix.${getArchiveFileExtension(renderedMixUri)}`;
        overdubManifest.renderedMixPath = renderedMixPath;
        addFileEntry(
            context,
            renderedMixPath,
            renderedMixUri,
            `Missing rendered overdub mix for ${clipLabel}.`
        );
    }

    const stemAllocator = createFolderAllocator();
    if (stems.length > 0) {
        addDirectory(context, `${clipStemPath} Overdubs`);
    }
    stems.forEach((stem) => {
        const stemManifest: ArchiveClipOverdubStemManifest = {
            id: stem.id,
            title: stem.title,
            gainDb: stem.gainDb,
            offsetMs: stem.offsetMs,
            tonePreset: stem.tonePreset,
            isMuted: stem.isMuted,
            durationMs: stem.durationMs,
            waveformPeaks: stem.waveformPeaks,
            recordingGrid: stem.recordingGrid,
        };

        if (stem.audioUri) {
            const stemStemPath = allocateChildPath(
                `${clipStemPath} Overdubs`,
                stem.title,
                stemAllocator,
                "Layer"
            );
            const audioPath = `${stemStemPath}.${getArchiveFileExtension(stem.audioUri)}`;
            stemManifest.audioPath = audioPath;
            addFileEntry(
                context,
                audioPath,
                stem.audioUri,
                `Missing overdub stem for ${clipLabel} / ${stem.title}.`
            );
        } else {
            stemManifest.audioMissing = true;
            context.warnings.push(`Missing overdub stem for ${clipLabel} / ${stem.title}.`);
        }

        overdubManifest.stems.push(stemManifest);
    });

    return overdubManifest;
}
