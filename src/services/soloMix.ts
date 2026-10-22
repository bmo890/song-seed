import * as FileSystem from "expo-file-system/legacy";
import type { NativeMixedRenderInput } from "../../modules/songnook-pitch-shift";
import { renderMixedFile } from "./pitchShift";

/**
 * Solo's mixes (domain/overdub.ts buildSoloMixInputs): the soloed layers alone, at the
 * full mix's length, played by the main transport in place of the mix. Rendered on
 * first use and kept while their inputs stay the same, so switching between a few
 * solo sets does not wait on a render. Scratch audio in the renderer's own temp space,
 * never library media: a handful at most, deleted as newer ones replace them.
 */

const FILE_PREFIX = "solo-mix-";

/** A solo mix stands in for the clip's mix while it plays; it is never the mix itself. */
export function isSoloMixUri(uri: string | null | undefined): boolean {
  return !!uri && uri.includes(FILE_PREFIX);
}

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

export function renderSoloMixFile(inputs: NativeMixedRenderInput[]): Promise<string> {
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
    outputFileName: `${FILE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }).then((result) => result.outputUri);
  cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  evictOldest();
  return pending;
}

/** Leaving the player: the scratch files go with it. */
export function releaseSoloMixFiles() {
  const entries = [...cache.values()];
  cache.clear();
  for (const entry of entries) {
    void entry.then((uri) => FileSystem.deleteAsync(uri, { idempotent: true })).catch(() => {});
  }
}
