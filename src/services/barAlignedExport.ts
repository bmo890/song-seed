/**
 * Writes the copy of a take that leaves the app (share sheet, clip links) so it starts
 * on a bar line. See domain/barAlignedExport.ts for the rule. The library's take is
 * only read.
 *
 * Lossless takes (WAV: every take recorded without a count-in) are rewritten sample
 * for sample: the header, then silence or nothing, then the take's own bytes. No
 * decode, no encode, no processing. A compressed take is exported as it is; a count-in
 * take is already cut at its downbeat.
 */
import { File } from "expo-file-system";
import type { RecordingGrid } from "../types";
import { barLeadIn, frameLevels, isLeadInQuiet, planBarAlignedExport, type BarAlignPlan } from "../domain/barAlignedExport";
import { encodeU32LE, parseWavLayout, WAV_HEADER_PROBE_BYTES } from "../domain/wavHeader";
import { persistLog } from "./persistLog";

const COPY_CHUNK_BYTES = 1 << 20;

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Write `sourceUri`, moved onto its first bar line, to `targetUri`. Returns the plan
 * it carried out; "asIs" means nothing was written and the caller copies the file.
 */
export async function writeBarAlignedCopy(
    sourceUri: string,
    grid: RecordingGrid | null | undefined,
    targetUri: string
): Promise<BarAlignPlan["kind"]> {
    const lead = barLeadIn(grid);
    if (!lead || !/\.wav$/i.test(sourceUri.split("?")[0] ?? "")) return "asIs";

    const source = new File(sourceUri).open();
    try {
        const fileSize = source.size ?? 0;
        source.offset = 0;
        const header = source.readBytes(Math.min(WAV_HEADER_PROBE_BYTES, fileSize));
        const layout = parseWavLayout(header, fileSize);
        if (!layout || layout.dataStart > header.length) return "asIs";

        const leadFrames = Math.round((lead.leadMs * layout.sampleRate) / 1000);
        const leadBytes = Math.min(layout.dataBytes, leadFrames * layout.blockAlign);
        source.offset = layout.dataStart;
        const quiet = isLeadInQuiet(frameLevels(source.readBytes(leadBytes), layout), layout.sampleRate, lead);
        const plan = planBarAlignedExport({ lead, sampleRate: layout.sampleRate, quiet });
        if (plan.kind === "asIs") return "asIs";

        const cutBytes = plan.kind === "cut" ? Math.min(layout.dataBytes, plan.frames * layout.blockAlign) : 0;
        const padBytes = plan.kind === "pad" ? plan.frames * layout.blockAlign : 0;
        const dataBytes = layout.dataBytes - cutBytes + padBytes;

        // The take's own header (format, any chunks before the audio), sizes restated.
        const outHeader = header.slice(0, layout.dataStart);
        outHeader.set(encodeU32LE(layout.dataStart + dataBytes - 8), 4);
        outHeader.set(encodeU32LE(dataBytes), layout.dataStart - 4);

        const target = new File(targetUri);
        target.create({ intermediates: true, overwrite: true });
        const out = target.open();
        try {
            out.writeBytes(outHeader);
            // Zero is silence for integer and float PCM alike.
            const silence = new Uint8Array(Math.min(padBytes, COPY_CHUNK_BYTES));
            for (let written = 0; written < padBytes; written += silence.length) {
                out.writeBytes(padBytes - written >= silence.length ? silence : silence.subarray(0, padBytes - written));
            }
            const end = layout.dataStart + layout.dataBytes;
            for (let at = layout.dataStart + cutBytes; at < end; at += COPY_CHUNK_BYTES) {
                source.offset = at;
                out.writeBytes(source.readBytes(Math.min(COPY_CHUNK_BYTES, end - at)));
                await yieldToUi();
            }
        } finally {
            out.close();
        }

        const ms = (plan.frames / layout.sampleRate) * 1000;
        persistLog(
            "export.bar",
            `${plan.kind} ${ms.toFixed(1)}ms (bar line at ${lead.leadMs.toFixed(1)}ms, bar ${lead.barMs.toFixed(1)}ms)`
        );
        return plan.kind;
    } finally {
        source.close();
    }
}
