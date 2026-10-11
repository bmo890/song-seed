import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useStore } from "../state/useStore";

type PreviewState = { itemId: string | null; playing: boolean; loading: boolean };
const IDLE: PreviewState = { itemId: null, playing: false, loading: false };

/**
 * Listen to a parcel's file before saving it — streamed straight from the
 * link, nothing written. One player at a time; it yields to the dock (pauses
 * it) and never starts while a take is recording. Released on unmount.
 */
export function useParcelPreview() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const [state, setState] = useState<PreviewState>(IDLE);

  const stop = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    const player = playerRef.current;
    playerRef.current = null;
    if (player) {
      try {
        player.pause();
        player.remove();
      } catch {
        // Already released.
      }
    }
    setState(IDLE);
  }, []);

  const toggle = useCallback(
    (item: { itemId: string; downloadUrl: string }) => {
      const store = useStore.getState();
      if (store.recordingIdeaId) return; // a recording is never interrupted by a preview
      const current = playerRef.current;
      if (current && state.itemId === item.itemId) {
        if (state.playing) {
          current.pause();
          setState((prev) => ({ ...prev, playing: false }));
        } else {
          current.play();
          setState((prev) => ({ ...prev, playing: true }));
        }
        return;
      }
      stop();
      store.requestInlineStop();
      if (store.playerIsPlaying) store.requestPlayerToggle();
      const player = createAudioPlayer({ uri: item.downloadUrl }, { updateInterval: 500 });
      playerRef.current = player;
      setState({ itemId: item.itemId, playing: true, loading: true });
      subscriptionRef.current = player.addListener("playbackStatusUpdate", (status) => {
        if (playerRef.current !== player) return;
        if (status.didJustFinish) {
          stop();
          return;
        }
        setState((prev) => ({
          ...prev,
          loading: !status.isLoaded,
          playing: status.playing,
        }));
      });
      player.play();
    },
    [state.itemId, state.playing, stop]
  );

  useEffect(() => stop, [stop]);

  return { activeItemId: state.itemId, playing: state.playing, loading: state.loading, toggle, stop };
}
