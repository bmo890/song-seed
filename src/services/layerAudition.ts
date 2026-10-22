import * as FileSystem from "expo-file-system/legacy";
import type { NativeMixedRenderInput } from "../../modules/songnook-pitch-shift";
import { renderMixedFile } from "./pitchShift";

/**
 * The two files Play together plays (domain/overdub.ts buildLayerAuditionInputs):
 * the song without the layer, and the layer with its level and tone. Rendered on
 * first use and kept while their inputs stay the same, so a nudge never waits on
 * a render. They are scratch audio in the renderer's own temp space, never library
 * media: a handful at most, deleted as soon as newer ones replace them.
 */

const MAX_KEPT = 4;
const cache = new Map<string, Promise<string>>();

function signatureOf(inputs: NativeMixedRenderInput[]) {
  return JSON.stringify(inputs);
}

function evictOldest() {
  while (cache.size > MAX_KEPT) {
    const [oldestKey, oldest] = cache.entries().next().value as [string, Promise<string>];
    cache.delete(oldestKey);
    void oldest
      .then((uri) => FileSystem.deleteAsync(uri, { idempotent: true }))
      .catch(() => {});
  }
}

export function renderAuditionFile(inputs: NativeMixedRenderInput[]): Promise<string> {
  const key = signatureOf(inputs);
  const existing = cache.get(key);
  if (existing) {
    // Most recently used goes to the back of the line.
    cache.delete(key);
    cache.set(key, existing);
    return existing;
  }
  const pending = renderMixedFile({
    inputs,
    outputFileName: `audition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }).then((result) => result.outputUri);
  cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  evictOldest();
  return pending;
}

/** Leaving the player: the scratch files go with it. */
export function releaseAuditionFiles() {
  const entries = [...cache.values()];
  cache.clear();
  for (const entry of entries) {
    void entry.then((uri) => FileSystem.deleteAsync(uri, { idempotent: true })).catch(() => {});
  }
}
