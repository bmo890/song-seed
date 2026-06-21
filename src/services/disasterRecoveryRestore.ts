import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { strFromU8, unzipSync } from "fflate";
import { resolveManagedUri } from "./storagePaths";
import { persistRawSnapshot } from "../state/db/storage";
import {
    DR_BACKUP_FORMAT_VERSION,
    type DrBackupManifest,
} from "./disasterRecoveryBackup";
import { STORE_NAME, STORE_VERSION, type PersistedAppStore } from "../state/useStore";
import { setPersistBlocked } from "../state/persistRuntime";

/**
 * Restore from a disaster-recovery archive produced by `buildDisasterRecoveryBackup`.
 *
 * Safety model: the archive is fully unzipped and EVERY file is verified against the
 * manifest's SHA-256 BEFORE anything is written. Only once all checks pass are media
 * files written and the metadata snapshot committed — so a corrupt or truncated backup
 * never partially overwrites the live library. Metadata is committed LAST, so a failure
 * mid-restore can leave (harmless) orphan audio files but never metadata pointing at
 * missing/bad files.
 *
 * The snapshot stores relative media paths; it is committed to AsyncStorage and rebased
 * to absolute URIs by `sanitizePersistedState` on the next hydration, so the caller must
 * restart the app to finish loading the restored library.
 */

const SNAPSHOT_ENTRY = "snapshot.json";
const MANIFEST_ENTRY = "manifest.json";
const MEDIA_PREFIX = "media/";

export type DrRestoreResult = {
    status: "complete" | "incomplete";
    counts: DrBackupManifest["counts"];
    /** Non-critical files the original backup recorded as missing (informational). */
    missing: DrBackupManifest["missing"];
    /** Restore commits to storage; the app must restart to hydrate the restored library. */
    needsRestart: true;
};

export class DrRestoreError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DrRestoreError";
    }
}

function base64ToBytes(base64: string) {
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

async function sha256OfString(data: string): Promise<string> {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
}

function parentDirOf(uri: string): string {
    const idx = uri.lastIndexOf("/");
    return idx === -1 ? uri : uri.slice(0, idx);
}

export async function restoreFromDisasterRecoveryBackup(archiveUri: string): Promise<DrRestoreResult> {
    const info = await FileSystem.getInfoAsync(archiveUri);
    if (!info.exists) {
        throw new DrRestoreError("Backup file could not be found.");
    }

    // Read + unzip the whole archive. fflate validates each entry's CRC-32 here and throws
    // on corruption, giving a first integrity gate before our SHA-256 checks.
    const archiveBase64 = await FileSystem.readAsStringAsync(archiveUri, {
        encoding: FileSystem.EncodingType.Base64,
    });
    let unzipped: Record<string, Uint8Array>;
    try {
        unzipped = unzipSync(base64ToBytes(archiveBase64));
    } catch (err) {
        throw new DrRestoreError(
            `Backup archive is corrupt or unreadable: ${err instanceof Error ? err.message : String(err)}`
        );
    }

    const snapshotBytes = unzipped[SNAPSHOT_ENTRY];
    const manifestBytes = unzipped[MANIFEST_ENTRY];
    if (!snapshotBytes || !manifestBytes) {
        throw new DrRestoreError("Backup is missing its snapshot or manifest — not a Song Seed backup.");
    }

    let manifest: DrBackupManifest;
    try {
        manifest = JSON.parse(strFromU8(manifestBytes)) as DrBackupManifest;
    } catch {
        throw new DrRestoreError("Backup manifest is unreadable.");
    }
    if (typeof manifest.formatVersion !== "number" || manifest.formatVersion > DR_BACKUP_FORMAT_VERSION) {
        throw new DrRestoreError(
            `Backup was made by a newer app version (format ${manifest.formatVersion}). Update the app to restore it.`
        );
    }

    const snapshotJson = strFromU8(snapshotBytes);

    // ── Verify EVERYTHING before writing anything ──
    const snapshotSha = await sha256OfString(snapshotJson);
    if (snapshotSha !== manifest.snapshotSha256) {
        throw new DrRestoreError("Backup metadata failed its integrity check (snapshot checksum mismatch).");
    }

    let snapshot: PersistedAppStore;
    try {
        snapshot = JSON.parse(snapshotJson) as PersistedAppStore;
    } catch {
        throw new DrRestoreError("Backup snapshot is unreadable.");
    }

    // Verify every file's SHA-256 BEFORE writing anything. Base64 is encoded one file at a
    // time and discarded after hashing so peak memory stays bounded (the unzipped bytes are
    // already held; we don't additionally retain every file's base64 at once).
    for (const record of manifest.files) {
        const data = unzipped[`${MEDIA_PREFIX}${record.path}`];
        if (!data) {
            throw new DrRestoreError(`Backup is missing audio file listed in its manifest: ${record.path}`);
        }
        const sha = await sha256OfString(bytesToBase64(data));
        if (sha !== record.sha256) {
            throw new DrRestoreError(`Audio file failed its integrity check: ${record.path}`);
        }
    }

    // ── All checks passed — write media, then commit metadata last ── (re-encode per file)
    const ensuredDirs = new Set<string>();
    for (const record of manifest.files) {
        const targetUri = resolveManagedUri(record.path);
        const dir = parentDirOf(targetUri);
        if (!ensuredDirs.has(dir)) {
            const dirInfo = await FileSystem.getInfoAsync(dir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
            }
            ensuredDirs.add(dir);
        }
        await FileSystem.writeAsStringAsync(targetUri, bytesToBase64(unzipped[`${MEDIA_PREFIX}${record.path}`]!), {
            encoding: FileSystem.EncodingType.Base64,
        });
    }

    // Commit metadata last, to the authoritative store (SQLite) that hydration reads from.
    // The snapshot keeps relative media paths; sanitizePersistedState rebases them to the
    // live container on the next hydration.
    await persistRawSnapshot(
        STORE_NAME,
        JSON.stringify({ state: snapshot, version: STORE_VERSION })
    );

    // Lock persistence so the still-loaded (pre-restore) in-memory store cannot write back
    // over the restored snapshot before the user restarts. The lock resets on next launch.
    setPersistBlocked(true);

    return {
        status: manifest.status,
        counts: manifest.counts,
        missing: manifest.missing,
        needsRestart: true,
    };
}
