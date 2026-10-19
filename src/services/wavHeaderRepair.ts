import { File } from "expo-file-system";
import { assessWavHeader, encodeU32LE, WAV_HEADER_PROBE_BYTES } from "../domain/wavHeader";
import { persistLog } from "./persistLog";

export type WavRepairOutcome = "notWav" | "finalized" | "empty" | "repaired";

/**
 * Finalize a WAV the recorder never got to close (see domain/wavHeader.ts): rewrite
 * its RIFF and `data` sizes in place from the bytes actually on disk. Eight bytes are
 * written; the audio is never touched. Anything that isn't a WAV this understands is
 * left alone, so it is safe to call on any clip's file before probing it.
 */
export function repairUnfinalizedWav(uri: string): WavRepairOutcome {
    if (!/\.wav$/i.test(uri)) return "notWav";
    const handle = new File(uri).open();
    try {
        const fileSize = handle.size ?? 0;
        handle.offset = 0;
        const header = handle.readBytes(Math.min(WAV_HEADER_PROBE_BYTES, fileSize));
        const assessment = assessWavHeader(header, fileSize);
        if (assessment.kind !== "unfinalized") return assessment.kind;
        for (const write of assessment.patch.writes) {
            handle.offset = write.offset;
            handle.writeBytes(encodeU32LE(write.value));
        }
        persistLog(
            "recording.recovered",
            `finalized wav header: ${assessment.patch.durationMs} ms ${uri.split("/").pop()}`
        );
        return "repaired";
    } finally {
        handle.close();
    }
}
