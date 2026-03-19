import * as FileSystem from "expo-file-system/legacy";
import { getLatestLyricsText } from "../lyrics";
import type { ClipVersion, Collection, SongIdea, Workspace } from "../types";
import { getCollectionScopeIds } from "../utils";
import {
    buildTimestampSlug,
    createZipArchive,
    ensureShareDirectory,
    getArchiveFileExtension,
    sanitizeArchiveSegment,
    shareFileUri,
    type ZipArchiveEntry,
} from "./audioStorage";
import { SONG_SEED_SHARE_DIR } from "./storagePaths";
import { cleanupShareTempFile, ensureArchiveSizeWithinSafetyLimit } from "./managedMedia";

export type LibraryExportFormat = "song-seed-archive" | "standard-zip";

export type LibraryExportScope = {
    workspaceIds: string[];
    collectionIds: string[];
    excludedCollectionIds?: string[];
};

export type SongSeedArchiveOptions = {
    includeFullSongHistory: boolean;
    includeNotes: boolean;
    includeLyrics: boolean;
    includeHiddenItems: boolean;
};

export type StandardZipOptions = {
    includeNotesAsText: boolean;
    includeLyricsAsText: boolean;
    includeHiddenItems: boolean;
};

export type ExportLibraryArgs =
    | {
          workspaces: Workspace[];
          format: "song-seed-archive";
          scope: LibraryExportScope;
          options: SongSeedArchiveOptions;
      }
    | {
          workspaces: Workspace[];
          format: "standard-zip";
          scope: LibraryExportScope;
          options: StandardZipOptions;
      };

export type LibraryExportResult = {
    archiveUri: string;
    archiveTitle: string;
    warningMessages: string[];
    exportedWorkspaces: number;
    exportedCollections: number;
    exportedSongs: number;
    exportedStandaloneClips: number;
};

type ArchiveManifest = {
    format: "song-seed-archive";
    schemaVersion: number;
    exportedAt: string;
    options: SongSeedArchiveOptions;
    scope: LibraryExportScope;
    warnings: string[];
    summary: {
        workspaces: number;
        collections: number;
        songs: number;
        standaloneClips: number;
    };
    workspaces: ArchiveWorkspaceManifest[];
};

type ArchiveWorkspaceManifest = {
    id: string;
    title: string;
    description?: string;
    isArchived?: boolean;
    folderPath: string;
    collections: ArchiveCollectionManifest[];
};

type ArchiveCollectionManifest = {
    id: string;
    title: string;
    parentCollectionId?: string | null;
    folderPath: string;
    songs: ArchiveSongManifest[];
    standaloneClips: ArchiveClipManifest[];
};

type ArchiveSongManifest = {
    id: string;
    title: string;
    folderPath: string;
    collectionId: string;
    createdAt: number;
    lastActivityAt: number;
    completionPct: number;
    notes?: string;
    lyrics?: string;
    historyIncluded: boolean;
    clips: ArchiveClipManifest[];
};

type ArchiveClipManifest = {
    id: string;
    title: string;
    createdAt: number;
    isPrimary: boolean;
    parentClipId?: string;
    durationMs?: number;
    notes?: string;
    audioPath?: string;
    audioMissing?: boolean;
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
};

const LIBRARY_EXPORT_SCHEMA_VERSION = 1;

export async function exportLibrary(args: ExportLibraryArgs): Promise<LibraryExportResult> {
    if (!FileSystem.documentDirectory) {
        throw new Error("Document directory unavailable.");
    }

    const build = args.format === "song-seed-archive" ? buildSongSeedArchive(args) : buildStandardZip(args);

    await ensureShareDirectory();

    const archiveLabel = args.format === "song-seed-archive" ? "Song Seed Archive" : "Song Seed Export";
    const archiveTitle = `${sanitizeArchiveSegment(archiveLabel)} ${buildTimestampSlug()}`;
    const archiveUri = `${SONG_SEED_SHARE_DIR}/${archiveTitle}.zip`;

    const validEntries = await Promise.all(
        build.entries.map(async (entry) => {
            if (!entry.fileUri) {
                return entry;
            }

            const info = await FileSystem.getInfoAsync(entry.fileUri);
            if (info.exists) {
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

    await ensureArchiveSizeWithinSafetyLimit(
        zipEntries.flatMap((entry) => (entry.fileUri ? [entry.fileUri] : [])),
        archiveTitle
    );

    try {
        await createZipArchive(archiveUri, zipEntries);
        await shareFileUri(archiveUri, archiveTitle, "application/zip");
    } finally {
        await cleanupShareTempFile(archiveUri);
    }

    return {
        archiveUri,
        archiveTitle,
        warningMessages: build.warnings,
        exportedWorkspaces: build.exportedWorkspaces,
        exportedCollections: build.exportedCollections,
        exportedSongs: build.exportedSongs,
        exportedStandaloneClips: build.exportedStandaloneClips,
    };
}

function buildSongSeedArchive(args: Extract<ExportLibraryArgs, { format: "song-seed-archive" }>): ExportBuildContext {
    const context = createExportBuildContext();
    const selectedWorkspaces = getSelectedWorkspaces(args.workspaces, args.scope);
    const folderAllocator = createFolderAllocator();
    const collectionFolderPaths = new Map<string, string>();
    const manifest: ArchiveManifest = {
        format: "song-seed-archive",
        schemaVersion: LIBRARY_EXPORT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        options: args.options,
        scope: args.scope,
        warnings: context.warnings,
        summary: {
            workspaces: 0,
            collections: 0,
            songs: 0,
            standaloneClips: 0,
        },
        workspaces: [],
    };

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
                    addTextEntry(
                        context,
                        `${songFolderPath}/song.json`,
                        JSON.stringify(songManifest, null, 2)
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
        },
    };

    if (context.warnings.length > 0) {
        addTextEntry(context, "export-report.json", JSON.stringify(report, null, 2));
    }

    return context;
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
        historyIncluded: options.includeFullSongHistory,
        clips: [],
    };

    if (options.includeNotes && idea.notes.trim().length > 0) {
        songManifest.notes = idea.notes;
        addTextEntry(context, `${songFolderPath}/Notes.txt`, idea.notes);
    }

    const lyricsText = options.includeLyrics ? getLatestLyricsText(idea).trim() : "";
    if (lyricsText) {
        songManifest.lyrics = lyricsText;
        addTextEntry(context, `${songFolderPath}/Lyrics.txt`, lyricsText);
    }

    clipsToExport.forEach((clip) => {
        const clipAudioUri = getClipExportAudioUri(clip);
        const clipStemPath = allocateChildPath(songFolderPath, clip.title || idea.title, clipAllocator, "Clip");
        const clipManifest: ArchiveClipManifest = {
            id: clip.id,
            title: clip.title,
            createdAt: clip.createdAt,
            isPrimary: clip.isPrimary,
            parentClipId: clip.parentClipId,
            durationMs: clip.durationMs,
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
    const clipAudioUri = primaryClip ? getClipExportAudioUri(primaryClip) : undefined;
    const clipStemPath = allocateChildPath(collectionFolderPath, idea.title, itemAllocator, "Clip");
    const clipManifest: ArchiveClipManifest = {
        id: idea.id,
        title: idea.title,
        createdAt: idea.createdAt,
        isPrimary: true,
        durationMs: primaryClip?.durationMs,
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

    return clipManifest;
}

function exportStandardSong(
    idea: SongIdea,
    itemStemPath: string,
    options: StandardZipOptions,
    context: ExportBuildContext
) {
    const primaryClip = getPrimaryClip(idea);
    const primaryAudioUri = primaryClip ? getClipExportAudioUri(primaryClip) : undefined;

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
    const audioUri = primaryClip ? getClipExportAudioUri(primaryClip) : undefined;

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

function getClipExportAudioUri(clip: ClipVersion) {
    return clip.audioUri ?? clip.sourceAudioUri;
}
