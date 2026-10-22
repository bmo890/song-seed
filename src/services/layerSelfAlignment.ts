import { InteractionManager } from "react-native";
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

/** Samples handed to the envelope per step; the JS thread breathes between steps. */
const ENVELOPE_CHUNK_FRAMES = 16_384;

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * The decoder's raw 16-bit PCM as floats. Read from `pcmData`, which crosses to JS as
 * one buffer on both platforms; `normalizedData` crosses on Android as a JS array built
 * one number at a time (two million for 20 s of stereo), enough to freeze or kill the
 * app right after a layer saves (founder, Android, 2026-10-22).
 */
function pcm16ToFloats(pcm: Uint8Array): Float32Array {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const out = new Float32Array(Math.floor(pcm.byteLength / 2));
  for (let i = 0; i < out.length; i += 1) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
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

  // Let the save land and the recorder close before the decode competes with them.
  await new Promise<void>((resolve) => InteractionManager.runAfterInteractions(() => resolve()));
  const decoded = await extractAudioData({
    fileUri: args.guideUri,
    startTimeMs: startMs,
    endTimeMs: endMs,
    includeNormalizedData: false,
    includeBase64Data: false,
    includeWavHeader: false,
  });
  const raw: unknown = decoded?.pcmData;
  const pcm = raw instanceof Uint8Array ? raw : raw instanceof ArrayBuffer ? new Uint8Array(raw) : null;
  // Both decoders write 16-bit PCM unless asked otherwise; iOS still reports the
  // source file's depth (32 for a rendered mix), so the field is not consulted.
  if (!pcm || pcm.byteLength === 0) return null;
  const samples = pcm16ToFloats(pcm);
  // Android hands a stereo song back interleaved; the envelope folds the channels.
  const channels = decoded.channels === 2 ? 2 : 1;
  const sampleRate =
    typeof decoded.sampleRate === "number" && decoded.sampleRate > 0
      ? decoded.sampleRate
      : (samples.length * 1000) / channels / (endMs - startMs);

  const state = createOnsetEnvelopeState(sampleRate, channels);
  const chunk = ENVELOPE_CHUNK_FRAMES * channels;
  for (let at = 0; at < samples.length; at += chunk) {
    appendOnsetSamples(state, samples.subarray(at, at + chunk));
    await nextTick();
  }
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
