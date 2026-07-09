import type { PersistedAppStore } from "../state/storeTypes";
import type { ClipOverdubState, ClipVersion, Workspace } from "../types";
import type {
    DrBackupFileRecord,
    DrBackupManifest,
    DrBackupMissingRecord,
    DrMediaKind,
} from "./disasterRecoveryBackup";

const SHA256_HEX = /^[a-f0-9]{64}$/i;
const RESTORE_TOKEN = /^[a-zA-Z0-9-]+$/;
const AUDIO_PREFIX = "songseed/audio/";
const ARCHIVE_PREFIX = "songseed/workspace-archives/";
// Overdub mix renders live here and are referenced by clips' renderedMixUri, so backups
// legitimately contain them. Restore MUST accept every prefix the backup writer packs —
// rejecting one hard-fails the whole restore (seen on-device with a preview mix).
const PREVIEW_PREFIX = "songseed/preview-audio/";
const SAFE_MEDIA_PREFIXES = [AUDIO_PREFIX, ARCHIVE_PREFIX, PREVIEW_PREFIX] as const;

type UnknownRecord = Record<string, unknown>;

export type SalvageSkippedItem = {
    kind: "clip" | "overdub-stem" | "workspace";
    /** Human-traceable reference, e.g. `idea:<id>/clip:<id>`. */
    ref: string;
    /** Display label assembled from titles where available. */
    label: string;
};

export type PreparedDisasterRecoverySnapshot = {
    snapshot: PersistedAppStore;
    destinationPathBySourcePath: Map<string, string>;
    /** Items dropped by a salvage restore because their audio is absent from the backup. */
    skipped: SalvageSkippedItem[];
};

function isRecord(value: unknown): value is UnknownRecord {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireString(value: unknown, label: string) {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Backup ${label} is invalid.`);
    }
    return value;
}

function requireNonNegativeInteger(value: unknown, label: string) {
    if (!Number.isSafeInteger(value) || Number(value) < 0) {
        throw new Error(`Backup ${label} is invalid.`);
    }
    return Number(value);
}

export function assertSafeBackupMediaPath(value: unknown): string {
    const path = requireString(value, "media path");
    if (
        path.startsWith("/") ||
        path.includes("\\") ||
        path.includes("\0") ||
        path.split("/").some((segment) => segment === "" || segment === "." || segment === "..") ||
        !SAFE_MEDIA_PREFIXES.some((prefix) => path.startsWith(prefix))
    ) {
        throw new Error(`Backup media path is unsafe: ${path}`);
    }
    return path;
}

function validateFileRecord(value: unknown): DrBackupFileRecord {
    if (!isRecord(value)) {
        throw new Error("Backup file manifest is invalid.");
    }
    const path = assertSafeBackupMediaPath(value.path);
    const sha256 = requireString(value.sha256, `checksum for ${path}`);
    if (!SHA256_HEX.test(sha256)) {
        throw new Error(`Backup checksum is invalid for ${path}.`);
    }
    return {
        path,
        sha256,
        sizeBytes: requireNonNegativeInteger(value.sizeBytes, `size for ${path}`),
    };
}

const MEDIA_KINDS = new Set<DrMediaKind>([
    "clip-audio",
    "clip-source",
    "overdub-stem",
    "overdub-mix",
    "workspace-archive",
]);

function validateMissingRecord(value: unknown): DrBackupMissingRecord {
    if (!isRecord(value)) {
        throw new Error("Backup missing-file manifest is invalid.");
    }
    const kind = requireString(value.kind, "missing-file kind") as DrMediaKind;
    if (!MEDIA_KINDS.has(kind)) {
        throw new Error(`Backup missing-file kind is unsupported: ${kind}`);
    }
    if (typeof value.critical !== "boolean") {
        throw new Error("Backup missing-file critical flag is invalid.");
    }
    return {
        path: requireString(value.path, "missing-file path"),
        kind,
        critical: value.critical,
        ref: requireString(value.ref, "missing-file reference"),
    };
}

export function validateDisasterRecoveryManifest(
    value: unknown,
    supportedFormatVersion: number,
    supportedStoreVersion: number
): DrBackupManifest {
    if (!isRecord(value)) {
        throw new Error("Backup manifest is invalid.");
    }
    if (value.formatVersion !== supportedFormatVersion) {
        if (typeof value.formatVersion === "number" && value.formatVersion > supportedFormatVersion) {
            throw new Error(
                `Backup was made by a newer app version (format ${value.formatVersion}). Update the app to restore it.`
            );
        }
        throw new Error(`Backup format ${String(value.formatVersion)} is unsupported.`);
    }

    const storeVersion = requireNonNegativeInteger(value.storeVersion, "store version");
    if (storeVersion < 1 || storeVersion > supportedStoreVersion) {
        throw new Error(
            storeVersion > supportedStoreVersion
                ? `Backup was made by a newer app data version (${storeVersion}). Update the app to restore it.`
                : `Backup data version ${storeVersion} is unsupported.`
        );
    }
    if (value.status !== "complete" && value.status !== "incomplete") {
        throw new Error("Backup completion status is invalid.");
    }
    if (!isRecord(value.counts)) {
        throw new Error("Backup counts are invalid.");
    }
    if (!Array.isArray(value.files) || !Array.isArray(value.missing)) {
        throw new Error("Backup file lists are invalid.");
    }

    const files = value.files.map(validateFileRecord);
    const seenPaths = new Set<string>();
    for (const file of files) {
        if (seenPaths.has(file.path)) {
            throw new Error(`Backup lists the same media file more than once: ${file.path}`);
        }
        seenPaths.add(file.path);
    }
    const missing = value.missing.map(validateMissingRecord);
    const hasCriticalMissing = missing.some((entry) => entry.critical);
    if ((value.status === "incomplete") !== hasCriticalMissing) {
        throw new Error("Backup completion status does not match its missing-file manifest.");
    }

    const snapshotSha256 = requireString(value.snapshotSha256, "snapshot checksum");
    if (!SHA256_HEX.test(snapshotSha256)) {
        throw new Error("Backup snapshot checksum is invalid.");
    }
    const createdAt = requireString(value.createdAt, "creation date");
    if (!Number.isFinite(Date.parse(createdAt))) {
        throw new Error("Backup creation date is invalid.");
    }

    return {
        formatVersion: value.formatVersion,
        storeVersion,
        appVersion: typeof value.appVersion === "string" ? value.appVersion : undefined,
        createdAt,
        status: value.status,
        counts: {
            workspaces: requireNonNegativeInteger(value.counts.workspaces, "workspace count"),
            collections: requireNonNegativeInteger(value.counts.collections, "collection count"),
            ideas: requireNonNegativeInteger(value.counts.ideas, "idea count"),
            clips: requireNonNegativeInteger(value.counts.clips, "clip count"),
        },
        snapshotSha256,
        files,
        missing,
    };
}

function validateSnapshotShape(value: unknown, manifest: DrBackupManifest): PersistedAppStore {
    if (!isRecord(value) || !Array.isArray(value.workspaces)) {
        throw new Error("Backup snapshot does not contain a valid workspace library.");
    }

    let collections = 0;
    let ideas = 0;
    let clips = 0;
    for (const workspace of value.workspaces) {
        if (
            !isRecord(workspace) ||
            typeof workspace.id !== "string" ||
            !Array.isArray(workspace.collections) ||
            !Array.isArray(workspace.ideas)
        ) {
            throw new Error("Backup contains an invalid workspace.");
        }
        collections += workspace.collections.length;
        ideas += workspace.ideas.length;
        for (const idea of workspace.ideas) {
            if (!isRecord(idea) || typeof idea.id !== "string" || !Array.isArray(idea.clips)) {
                throw new Error("Backup contains an invalid song or idea.");
            }
            clips += idea.clips.length;
            if (idea.clips.some((clip) => !isRecord(clip) || typeof clip.id !== "string")) {
                throw new Error("Backup contains an invalid clip.");
            }
        }
    }

    const actualCounts = {
        workspaces: value.workspaces.length,
        collections,
        ideas,
        clips,
    };
    if (
        actualCounts.workspaces !== manifest.counts.workspaces ||
        actualCounts.collections !== manifest.counts.collections ||
        actualCounts.ideas !== manifest.counts.ideas ||
        actualCounts.clips !== manifest.counts.clips
    ) {
        throw new Error("Backup entity counts do not match its snapshot.");
    }
    return value as unknown as PersistedAppStore;
}

function buildDestinationPath(sourcePath: string, restoreToken: string) {
    // Exhaustive over the safe prefixes: each restored file lands in a token-scoped
    // subfolder of ITS OWN directory. A fallthrough here would silently mangle paths
    // for any prefix the validator accepts but this mapping forgot.
    const prefix = SAFE_MEDIA_PREFIXES.find((candidate) => sourcePath.startsWith(candidate));
    if (!prefix) {
        throw new Error(`Backup media path is unsafe: ${sourcePath}`);
    }
    return `${prefix}restored-${restoreToken}/${sourcePath.slice(prefix.length)}`;
}

type SalvageContext = {
    /** True when the backup can supply this uri's audio (safe path present in the manifest). */
    hasDestination: (uri: string) => boolean;
    onSkip: (item: SalvageSkippedItem) => void;
};

function rewriteOverdub(
    overdub: ClipOverdubState,
    requireDestination: (uri: string | undefined, label: string) => string | undefined,
    optionalDestination: (uri: string | undefined) => string | undefined,
    clipRef: string,
    salvage?: SalvageContext
): ClipOverdubState | undefined {
    let stems = overdub.stems;
    if (salvage) {
        stems = stems.filter((stem) => {
            if (!stem.audioUri || salvage.hasDestination(stem.audioUri)) return true;
            salvage.onSkip({
                kind: "overdub-stem",
                ref: `${clipRef}/stem:${stem.id}`,
                label: stem.title || `Layer ${stem.id}`,
            });
            return false;
        });
        // An overdub whose layers are all gone has nothing left to represent — the mix
        // is derived from the stems.
        if (stems.length === 0) return undefined;
    }
    const renderedMixUri = optionalDestination(overdub.renderedMixUri);
    return {
        ...overdub,
        stems: stems.map((stem) => ({
            ...stem,
            audioUri: requireDestination(stem.audioUri, `overdub stem ${stem.id}`),
        })),
        renderedMixUri,
        ...(renderedMixUri
            ? null
            : {
                  renderedMixDurationMs: undefined,
                  renderedMixWaveformPeaks: undefined,
                  lastRenderedAt: undefined,
              }),
    };
}

function rewriteClip(
    clip: ClipVersion,
    requireDestination: (uri: string | undefined, label: string) => string | undefined,
    optionalDestination: (uri: string | undefined) => string | undefined,
    clipRef: string,
    salvage?: SalvageContext
): ClipVersion {
    return {
        ...clip,
        audioUri: requireDestination(clip.audioUri, `clip ${clip.id}`),
        sourceAudioUri: optionalDestination(clip.sourceAudioUri),
        overdub: clip.overdub
            ? rewriteOverdub(clip.overdub, requireDestination, optionalDestination, clipRef, salvage)
            : undefined,
    };
}

export function prepareDisasterRecoverySnapshot(
    value: unknown,
    manifest: DrBackupManifest,
    restoreToken: string,
    options?: {
        /**
         * Salvage an INCOMPLETE backup: instead of failing on audio the backup itself
         * recorded as missing, drop the affected clips / overdub layers / archived
         * workspaces and report them in `skipped`. Everything else restores normally.
         */
        salvage?: boolean;
    }
): PreparedDisasterRecoverySnapshot {
    if (!RESTORE_TOKEN.test(restoreToken)) {
        throw new Error("Restore destination token is invalid.");
    }
    const snapshot = validateSnapshotShape(value, manifest);
    const destinationPathBySourcePath = new Map(
        manifest.files.map((record) => [record.path, buildDestinationPath(record.path, restoreToken)])
    );

    const requireDestination = (uri: string | undefined, label: string) => {
        if (!uri) return undefined;
        const sourcePath = assertSafeBackupMediaPath(uri);
        const destination = destinationPathBySourcePath.get(sourcePath);
        if (!destination) {
            throw new Error(`Backup is missing critical audio for ${label}: ${sourcePath}`);
        }
        return destination;
    };
    const optionalDestination = (uri: string | undefined) => {
        if (!uri) return undefined;
        let sourcePath: string;
        try {
            sourcePath = assertSafeBackupMediaPath(uri);
        } catch {
            return undefined;
        }
        return destinationPathBySourcePath.get(sourcePath);
    };

    const skipped: SalvageSkippedItem[] = [];
    const salvage: SalvageContext | undefined = options?.salvage
        ? {
              hasDestination: (uri: string) => {
                  try {
                      return destinationPathBySourcePath.has(assertSafeBackupMediaPath(uri));
                  } catch {
                      return false;
                  }
              },
              onSkip: (item) => skipped.push(item),
          }
        : undefined;

    const workspaces: Workspace[] = [];
    for (const workspace of snapshot.workspaces) {
        if (
            salvage &&
            workspace.archiveState?.archiveUri &&
            !salvage.hasDestination(workspace.archiveState.archiveUri)
        ) {
            // An archived workspace's ONLY audio lives inside its archive package; without
            // it there is nothing to restore.
            salvage.onSkip({
                kind: "workspace",
                ref: `workspace:${workspace.id}`,
                label: workspace.title,
            });
            continue;
        }

        workspaces.push({
            ...workspace,
            archiveState: workspace.archiveState
                ? {
                      ...workspace.archiveState,
                      archiveUri: requireDestination(
                          workspace.archiveState.archiveUri,
                          `archived workspace ${workspace.id}`
                      )!,
                  }
                : undefined,
            ideas: workspace.ideas.map((idea) => {
                const hadPrimary = idea.clips.some((clip) => clip.isPrimary);
                let clips = idea.clips.flatMap((clip) => {
                    const clipRef = `idea:${idea.id}/clip:${clip.id}`;
                    if (salvage && clip.audioUri && !salvage.hasDestination(clip.audioUri)) {
                        salvage.onSkip({
                            kind: "clip",
                            ref: clipRef,
                            label: `${idea.title}${clip.title ? ` · ${clip.title}` : ""}`,
                        });
                        return [];
                    }
                    return [
                        rewriteClip(clip, requireDestination, optionalDestination, clipRef, salvage),
                    ];
                });
                // If salvage dropped the primary take, promote the first surviving clip so
                // the song is never left without a primary.
                if (salvage && hadPrimary && clips.length > 0 && !clips.some((clip) => clip.isPrimary)) {
                    clips = clips.map((clip, index) =>
                        index === 0 ? { ...clip, isPrimary: true } : clip
                    );
                }
                return { ...idea, clips };
            }),
        });
    }

    return {
        snapshot: { ...snapshot, workspaces },
        destinationPathBySourcePath,
        skipped,
    };
}
