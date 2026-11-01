/**
 * Writes the "Export for DAW" copy of a take (founder, 2026-11-01): it starts on a bar
 * line and ends on one, so in a DAW at the same tempo it drops onto a bar and sits.
 * See domain/barAlignedExport.ts for the rule. The library's take is only read.
 *
 * WAV is rewritten sample for sample: the header, then silence or nothing, then the
 * take's own bytes, then silence to the bar line. No decode, no encode, no processing.
 * A compressed take is first decoded to WAV natively (the same start the player uses),
 * then written the same way; a binary without that decoder hands it over as it is.
 */
import { File } from "expo-file-system";
import type { RecordingGrid } from "../types";
import {
    barLeadIn,
    barTailFrames,
    frameLevels,
    isLeadInQuiet,
    planBarAlignedExport,
    type BarAlignPlan,
} from "../domain/barAlignedExport";
import { encodeU32LE, parseWavLayout, WAV_HEADER_PROBE_BYTES } from "../domain/wavHeader";
import { persistLog } from "./persistLog";

const COPY_CHUNK_BYTES = 1 << 20;

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Zero is silence for integer and float PCM alike. */
function writeSilence(out: { writeBytes(bytes: Uint8Array): void }, bytes: number) {
    const silence = new Uint8Array(Math.min(bytes, COPY_CHUNK_BYTES));
    for (let written = 0; written < bytes; written += silence.length) {
        out.writeBytes(bytes - written >= silence.length ? silence : silence.subarray(0, bytes - written));
    }
}

export type BarAlignedCopy = {
    head: BarAlignPlan;
    /** Silence added after the take to finish its last bar. */
    tailFrames: number;
};

/**
 * Write `sourceUri` (a WAV) onto the bar lines at `targetUri`. Null means nothing was
 * written: not a WAV, or a take with no grid to line up to.
 */
export async function writeBarAlignedCopy(
    sourceUri: string,
    grid: RecordingGrid | null | undefined,
    targetUri: string
): Promise<BarAlignedCopy | null> {
    const lead = barLeadIn(grid);
    if (!lead || !/\.wav$/i.test(sourceUri.split("?")[0] ?? "")) return null;

    const source = new File(sourceUri).open();
    try {
        const fileSize = source.size ?? 0;
        source.offset = 0;
        const header = source.readBytes(Math.min(WAV_HEADER_PROBE_BYTES, fileSize));
        const layout = parseWavLayout(header, fileSize);
        if (!layout || layout.dataStart > header.length) return null;

        const leadFrames = Math.round((lead.leadMs * layout.sampleRate) / 1000);
        const leadBytes = Math.min(layout.dataBytes, leadFrames * layout.blockAlign);
        source.offset = layout.dataStart;
        const quiet = isLeadInQuiet(frameLevels(source.readBytes(leadBytes), layout), layout.sampleRate, lead);
        const plan = planBarAlignedExport({ lead, sampleRate: layout.sampleRate, quiet });

        const cutBytes = plan.kind === "cut" ? Math.min(layout.dataBytes, plan.frames * layout.blockAlign) : 0;
        const padBytes = plan.kind === "pad" ? plan.frames * layout.blockAlign : 0;
        const bodyBytes = layout.dataBytes - cutBytes + padBytes;
        const tailFrames = barTailFrames({
            frames: Math.floor(bodyBytes / layout.blockAlign),
            sampleRate: layout.sampleRate,
            lead,
        });
        const tailBytes = tailFrames * layout.blockAlign;
        const dataBytes = bodyBytes + tailBytes;

        // The take's own header (format, any chunks before the audio), sizes restated.
        const outHeader = header.slice(0, layout.dataStart);
        outHeader.set(encodeU32LE(layout.dataStart + dataBytes - 8), 4);
        outHeader.set(encodeU32LE(dataBytes), layout.dataStart - 4);

        const target = new File(targetUri);
        target.create({ intermediates: true, overwrite: true });
        const out = target.open();
        try {
            out.writeBytes(outHeader);
            writeSilence(out, padBytes);
            const end = layout.dataStart + layout.dataBytes;
            for (let at = layout.dataStart + cutBytes; at < end; at += COPY_CHUNK_BYTES) {
                source.offset = at;
                out.writeBytes(source.readBytes(Math.min(COPY_CHUNK_BYTES, end - at)));
                await yieldToUi();
            }
            writeSilence(out, tailBytes);
        } finally {
            out.close();
        }

        const headMs = plan.kind === "asIs" ? 0 : (plan.frames / layout.sampleRate) * 1000;
        persistLog(
            "export.bar",
            `${plan.kind} ${headMs.toFixed(1)}ms, tail ${((tailFrames / layout.sampleRate) * 1000).toFixed(1)}ms ` +
                `(bar line at ${lead.leadMs.toFixed(1)}ms, bar ${lead.barMs.toFixed(1)}ms)`
        );
        return { head: plan, tailFrames };
    } finally {
        source.close();
    }
}
