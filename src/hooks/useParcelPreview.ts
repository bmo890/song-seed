import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useStore } from "../state/useStore";
import { downloadTransferItem, type TransferItemPayload } from "../services/receiveTransfer";

type PreviewState = { itemId: string | null; playing: boolean; loading: boolean };
const IDLE: PreviewState = { itemId: null, playing: false, loading: false };

/**
 * Listen to a parcel's file before saving it — streamed straight from the
 * link, nothing written. A sealed file can't stream (the server holds only
 * sealed bytes): it downloads to the receive cache and opens there first.
 * One player at a time; it yields to the dock (pauses it) and never starts
 * while a take is recording. Released on unmount.
 */
export function useParcelPreview() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const [state, setState] = useState<PreviewState>(IDLE);
  // The preview asked for last: an opened sealed file plays only if it still is.
  const requestRef = useRef(0);

  const stop = useCallback(() => {
    requestRef.current += 1;
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

  const start = useCallback(
    (itemId: string, uri: string) => {
      const player = createAudioPlayer({ uri }, { updateInterval: 500 });
      playerRef.current = player;
      setState({ itemId, playing: true, loading: true });
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
    [stop]
  );

  const toggle = useCallback(
    (item: TransferItemPayload) => {
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
      const request = requestRef.current;
      setState({ itemId: item.itemId, playing: true, loading: true });
      if (item.sealed) {
        void downloadTransferItem(item)
          .then((localUri) => {
            if (requestRef.current === request) start(item.itemId, localUri);
          })
          .catch(() => {
            if (requestRef.current === request) stop();
          });
        return;
      }
      start(item.itemId, item.downloadUrl);
    },
    [start, state.itemId, state.playing, stop]
  );

  useEffect(() => stop, [stop]);

  return { activeItemId: state.itemId, playing: state.playing, loading: state.loading, toggle, stop };
}
