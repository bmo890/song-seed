import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import { IncrementalBase64Sha256 } from "./streamingIntegrity";
import {
    throwIfBackupCancelled,
    yieldToBackupUi,
    type BackupOperationOptions,
} from "./backupOperation";

/**
 * Backup manifests hash each file's BASE64 representation (v1 format — see
 * IncrementalBase64Sha256). The fast path here reproduces that exact digest natively:
 * a native base64 file read + a native SHA-256 over the resulting string. Both awaits
 * leave the JS thread free, unlike the pure-JS streaming hash (~0.6MB/s on device,
 * which made a ~1GB library take ~27 minutes per pass and froze the UI throughout).
 *
 * The whole-file read is capped: the transient base64 string is ~1.33× the file size,
 * so oversized files fall back to the bounded-memory JS streaming path instead of
 * risking memory pressure. Every audio clip falls far under the cap; only a very large
 * archived-workspace package can exceed it.
 */
export const NATIVE_BASE64_SHA256_MAX_BYTES = 64 * 1024 * 1024;

const STREAM_CHUNK_BYTES = 512 * 1024;
const YIELD_AFTER_BYTES = 2 * 1024 * 1024;

/** SHA-256 (hex) of the file's base64 representation — the v1 backup manifest format. */
export async function sha256OfFileBase64(
    absUri: string,
    sizeBytes: number,
    options?: BackupOperationOptions,
    nativeMaxBytes = NATIVE_BASE64_SHA256_MAX_BYTES
): Promise<string> {
    throwIfBackupCancelled(options?.signal);

    if (sizeBytes <= nativeMaxBytes) {
        const base64 = await FileSystem.readAsStringAsync(absUri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        throwIfBackupCancelled(options?.signal);
        return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
    }

    console.warn(
        `[backup] file exceeds the ${nativeMaxBytes / (1024 * 1024)}MB native-hash cap; ` +
            `using the slow streaming hash (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB): ${absUri}`
    );
    const handle = new File(absUri).open();
    const sha = new IncrementalBase64Sha256();
    let bytesSinceYield = 0;
    try {
        while (true) {
            throwIfBackupCancelled(options?.signal);
            const chunk = handle.readBytes(STREAM_CHUNK_BYTES);
            if (chunk.length === 0) break;
            sha.update(chunk);
            bytesSinceYield += chunk.length;
            if (bytesSinceYield >= YIELD_AFTER_BYTES) {
                bytesSinceYield = 0;
                await yieldToBackupUi(options?.signal);
            }
        }
    } finally {
        handle.close();
    }
    return sha.digestHex();
}
