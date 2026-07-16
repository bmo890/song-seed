import { Asset } from "expo-asset";

// The native lock-screen surfaces (iOS MPNowPlayingInfoCenter, Android media
// notification) load artwork through a plain URL connection, so the bundled
// asset has to be materialized as a file:// (or http:// in dev) URL first.
let resolvedUrl: string | undefined;
let inflight: Promise<void> | null = null;

export function prefetchLockScreenArtwork(): void {
  if (resolvedUrl || inflight) return;
  inflight = (async () => {
    try {
      const asset = Asset.fromModule(require("../../assets/lock-screen-artwork.png"));
      if (!asset.localUri) {
        await asset.downloadAsync();
      }
      resolvedUrl = asset.localUri ?? asset.uri ?? undefined;
    } catch {
      // Artwork is decorative — playback and lock-screen controls proceed without it.
      resolvedUrl = undefined;
    } finally {
      inflight = null;
    }
  })();
}

/** Best-effort: returns undefined until the prefetch (kicked off here or earlier) resolves. */
export function getLockScreenArtworkUrl(): string | undefined {
  prefetchLockScreenArtwork();
  return resolvedUrl;
}
