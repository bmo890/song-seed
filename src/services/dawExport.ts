/**
 * "Export for DAW" (founder, 2026-11-01): a choice beside Share audio, never the
 * default. A take recorded to the click goes out as a WAV that starts on a bar line and
 * ends on one, named with its tempo ("Idea 3 · 100 bpm.wav"), so in a DAW project at the
 * same tempo it drops onto a bar and sits there with nothing to trim.
 *
 * The bar lines come from the take's own grid, the one the play-along click uses: if the
 * click sits on the take in SongNook, the export sits on the DAW's grid.
 */
import * as FileSystem from "expo-file-system/legacy";
import SongNookPitchShiftModule from "../../modules/songnook-pitch-shift";
import { barLeadIn, dawExportBaseName } from "../domain/barAlignedExport";
import { getClipPlaybackUri } from "../domain/clipPresentation";
import type { ClipVersion, RecordingGrid } from "../types";
import {
    ensureShareDirectory,
    getArchiveFileExtension,
    getAudioShareMimeType,
    sanitizeArchiveSegment,
    shareFileUri,
} from "./audioStorage";
import { writeBarAlignedCopy } from "./barAlignedExport";
import { persistLog } from "./persistLog";
import { SONG_NOOK_SHARE_DIR } from "./storagePaths";

const isWav = (uri: string) => /\.wav$/i.test(uri.split("?")[0] ?? "");

/** Only a take recorded to the click knows where its bar lines are. */
export function canExportForDaw(grid: RecordingGrid | null | undefined): grid is RecordingGrid {
    return barLeadIn(grid) != null;
}

export type DawExportTarget = { audioUri: string; title: string; grid: RecordingGrid };

/** What Export for DAW would send for this take (the mix, when it has layers: same
 *  timeline, same grid), or null when the take wasn't recorded to the click. */
export function dawExportTargetForClip(
    clip: ClipVersion | null | undefined,
    fallbackTitle = ""
): DawExportTarget | null {
    const grid = clip?.recordingGrid;
    const audioUri = clip ? getClipPlaybackUri(clip) : undefined;
    if (!clip || !audioUri || !canExportForDaw(grid)) return null;
    return { audioUri, title: clip.title || fallbackTitle, grid };
}

export async function exportClipForDaw(audioUri: string, title: string, grid: RecordingGrid) {
    const info = await FileSystem.getInfoAsync(audioUri);
    if (!info.exists) throw new Error("File not found.");
    await ensureShareDirectory();

    // A folder of its own, so the file the DAW sees carries only its name.
    const folder = `${SONG_NOOK_SHARE_DIR}/daw-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    const baseName = sanitizeArchiveSegment(dawExportBaseName(title || "Clip", grid));
    let decodedUri: string | null = null;
    try {
        let source = audioUri;
        if (!isWav(audioUri) && typeof SongNookPitchShiftModule?.decodeToWav === "function") {
            decodedUri = (await SongNookPitchShiftModule.decodeToWav({ inputUri: audioUri })).outputUri;
            source = decodedUri;
        }
        let target = `${folder}/${baseName}.wav`;
        if (!(await writeBarAlignedCopy(source, grid, target))) {
            // A compressed take on a binary without the decoder goes as it was recorded,
            // under its tempo name. A count-in take already starts on its downbeat.
            target = `${folder}/${baseName}.${getArchiveFileExtension(audioUri)}`;
            await FileSystem.copyAsync({ from: audioUri, to: target });
            persistLog("export.bar", "as recorded: no decoder in this build");
        }
        await shareFileUri(target, baseName, getAudioShareMimeType(target));
    } finally {
        await FileSystem.deleteAsync(folder, { idempotent: true }).catch(() => undefined);
        if (decodedUri) await FileSystem.deleteAsync(decodedUri, { idempotent: true }).catch(() => undefined);
    }
}
