import { extractAudioData } from "@siteed/audio-studio";
import { appActions } from "../state/actions";
import {
  appendOnsetSamples,
  createOnsetEnvelopeState,
  finishOnsetEnvelope,
  type OnsetEnvelope,
} from "../domain/onsetEnvelope";
import {
  LAYER_ALIGN_SEARCH_MS,
  MIN_LAYER_ALIGN_MS,
  MIN_LAYER_CORRECTION_MS,
  measureLayerAgainstGuide,
  type LayerAlignment,
} from "../domain/layerAlignment";

/** Enough song to be certain; more only costs decode time and JS work. */
const MAX_ALIGN_SPAN_MS = 20_000;

function asSamples(value: unknown): Float32Array | null {
  if (value instanceof Float32Array) return value;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Float32Array.from(value as ArrayLike<number>);
  return null;
}

/**
 * Right after a layer is saved: measure it against the guide it was played to, and move
 * it where it was really played when the measurement is certain (domain/layerAlignment.ts).
 *
 * This is what makes a layer recorded over the speaker land exactly, whatever the phone
 * reports about its latency: the measured layers in the simulator were 45–49 ms late with
 * the latency model believing it had nothing to correct (2026-10-22). On headphones there
 * is no song in the layer to measure and the layer keeps its modelled place.
 *
 * The guide is decoded at its own rate with no conversion, so its timeline is the file's.
 */
export async function selfAlignRecordedLayer(args: {
  ideaId: string;
  clipId: string;
  stemId: string;
  guideUri: string;
  guideDurationMs: number;
  layerEnvelope: OnsetEnvelope | null | undefined;
  offsetMs: number;
}): Promise<LayerAlignment | null> {
  const { layerEnvelope } = args;
  if (!layerEnvelope || layerEnvelope.bins.length === 0) return null;
  const layerMs = layerEnvelope.bins.length * layerEnvelope.binMs;
  const spanMs = Math.min(layerMs, MAX_ALIGN_SPAN_MS);
  if (spanMs < MIN_LAYER_ALIGN_MS) return null;

  const startMs = Math.max(0, Math.floor(args.offsetMs - LAYER_ALIGN_SEARCH_MS - 50));
  const endMs = Math.min(
    Math.floor(args.guideDurationMs) - 5,
    Math.ceil(args.offsetMs + spanMs + LAYER_ALIGN_SEARCH_MS + 50)
  );
  if (endMs - startMs < MIN_LAYER_ALIGN_MS) return null;

  const decoded = await extractAudioData({
    fileUri: args.guideUri,
    startTimeMs: startMs,
    endTimeMs: endMs,
    includeNormalizedData: true,
    includeBase64Data: false,
    includeWavHeader: false,
  });
  const samples = asSamples(decoded?.normalizedData);
  if (!samples || samples.length === 0) return null;
  const sampleRate =
    typeof decoded?.sampleRate === "number" && decoded.sampleRate > 0
      ? decoded.sampleRate
      : (samples.length * 1000) / (endMs - startMs);

  const state = createOnsetEnvelopeState(sampleRate, 1);
  appendOnsetSamples(state, samples);
  const guideEnvelope = finishOnsetEnvelope(state);
  if (!guideEnvelope) return null;

  const layerBins = layerEnvelope.bins.slice(0, Math.floor(spanMs / layerEnvelope.binMs));
  const result = measureLayerAgainstGuide({
    layer: { bins: layerBins, binMs: layerEnvelope.binMs },
    guide: guideEnvelope,
    guideStartMs: startMs,
    offsetMs: args.offsetMs,
  });
  if (!result) {
    console.log("[timing] layer self-align: no song heard in the layer (headphones?) — kept the modelled place");
    return null;
  }
  console.log(
    `[timing] layer self-align: ${result.residualMs >= 0 ? "+" : ""}${result.residualMs.toFixed(1)}ms ` +
      `(halves ${result.halvesMs.map((h) => h.toFixed(1)).join("/")}, confidence ${result.confidence.toFixed(1)})`
  );
  if (Math.abs(result.residualMs) >= MIN_LAYER_CORRECTION_MS) {
    await appActions.placeRecordedOverdubStem(
      args.ideaId,
      args.clipId,
      args.stemId,
      Math.round(args.offsetMs - result.residualMs)
    );
  }
  return result;
}
