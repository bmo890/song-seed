import SongseedPitchShiftModule, {
  type NativeMixedRenderRequest,
  type NativeMixedRenderResult,
  type NativePitchShiftCapabilities,
  type NativePitchShiftRenderRequest,
  type NativePitchShiftRenderResult,
} from "../../modules/songseed-pitch-shift";
import {
  buildUnavailablePitchShiftCapabilities,
  clampPitchShiftSemitones,
  type PitchShiftCapabilities,
} from "../pitchShift";

function normalizeCapabilities(
  capabilities: NativePitchShiftCapabilities | null | undefined
): PitchShiftCapabilities {
  if (!capabilities) {
    return buildUnavailablePitchShiftCapabilities();
  }

  return {
    isAvailable: capabilities.isAvailable,
    supportsPracticePlayback: capabilities.supportsPracticePlayback,
    supportsEditorPreview: capabilities.supportsEditorPreview,
    supportsOfflineRender: capabilities.supportsOfflineRender,
    minSemitones: capabilities.minSemitones,
    maxSemitones: capabilities.maxSemitones,
  };
}

export function isPitchShiftAvailable() {
  return SongseedPitchShiftModule?.isAvailable?.() ?? false;
}

export async function getPitchShiftCapabilities(): Promise<PitchShiftCapabilities> {
  if (!SongseedPitchShiftModule) {
    return buildUnavailablePitchShiftCapabilities();
  }

  try {
    return normalizeCapabilities(await SongseedPitchShiftModule.getCapabilities());
  } catch (error) {
    console.warn("Pitch shift capabilities lookup failed", error);
    return buildUnavailablePitchShiftCapabilities();
  }
}

export async function renderPitchShiftedFile(
  request: Omit<NativePitchShiftRenderRequest, "semitones" | "playbackRate"> & {
    semitones: number;
    playbackRate?: number;
  }
): Promise<NativePitchShiftRenderResult> {
  if (!SongseedPitchShiftModule) {
    throw new Error("Pitch shift module unavailable.");
  }

  const capabilities = await getPitchShiftCapabilities();
  if (!capabilities.isAvailable || !capabilities.supportsOfflineRender) {
    throw new Error("Pitch shift file rendering is not available yet.");
  }

  return SongseedPitchShiftModule.renderPitchShiftedFile({
    ...request,
    semitones: clampPitchShiftSemitones(request.semitones),
    playbackRate: request.playbackRate ?? 1,
  });
}

export async function renderMixedFile(
  request: NativeMixedRenderRequest
): Promise<NativeMixedRenderResult> {
  if (!SongseedPitchShiftModule) {
    throw new Error("Pitch shift module unavailable.");
  }

  const capabilities = await getPitchShiftCapabilities();
  if (!capabilities.isAvailable || !capabilities.supportsOfflineRender) {
    throw new Error("Mixed audio rendering is not available yet.");
  }

  if (!Array.isArray(request.inputs) || request.inputs.length === 0) {
    throw new Error("Mixed audio rendering requires at least one input.");
  }

  return SongseedPitchShiftModule.renderMixedFile(request);
}
