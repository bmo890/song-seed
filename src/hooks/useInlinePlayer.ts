import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipVersion, InlineTarget } from "../types";
import { activatePlaybackAudioSession } from "../services/audioSession";
import { useStore } from "../state/useStore";

type Args = {
  onBeforePlayNew?: () => Promise<void> | void;
};

export function useInlinePlayer({ onBeforePlayNew }: Args = {}) {
  const [inlineTarget, setInlineTarget] = useState<InlineTarget>(null);
  const wasPlayingBeforeScrubRef = useRef(false);
  const scrubPausePromiseRef = useRef<Promise<void> | null>(null);
  const stopRequestToken = useStore((s) => s.inlineStopRequestToken);
  const setStoreInlineTarget = useStore((s) => s.setInlineTarget);
  const setInlinePlaybackState = useStore((s) => s.setInlinePlaybackState);
  const handledStopTokenRef = useRef(stopRequestToken);

  const playerOptions = useMemo(() => ({ updateInterval: 100 }), []);
  const player = useAudioPlayer(null, playerOptions);
  const status = useAudioPlayerStatus(player);
  const inlinePosition = Math.round((status.currentTime ?? 0) * 1000);
  const inlineDuration = Math.round((status.duration ?? 0) * 1000);
  const isInlinePlaying = !!status.playing && !status.didJustFinish;

  useEffect(() => {
    if (status.didJustFinish && inlineTarget) {
      setInlineTarget(null);
    }
  }, [inlineTarget, status.didJustFinish]);

  useEffect(() => {
    setStoreInlineTarget(inlineTarget);
  }, [inlineTarget, setStoreInlineTarget]);

  useEffect(() => {
    setInlinePlaybackState({
      positionMs: inlinePosition,
      durationMs: inlineDuration,
      isPlaying: isInlinePlaying,
    });
  }, [inlineDuration, inlinePosition, isInlinePlaying, setInlinePlaybackState]);

  useEffect(() => {
    if (stopRequestToken === handledStopTokenRef.current) return;
    handledStopTokenRef.current = stopRequestToken;
    void resetInlinePlayer();
  }, [stopRequestToken]);

  async function resetInlinePlayer() {
    await player.pause();
    scrubPausePromiseRef.current = null;
    wasPlayingBeforeScrubRef.current = false;
    setInlineTarget(null);
    setInlinePlaybackState({
      positionMs: 0,
      durationMs: 0,
      isPlaying: false,
    });
  }

  async function toggleInlinePlayback(ideaId: string, clip: ClipVersion) {
    if (!clip.audioUri) return;

    if (inlineTarget && inlineTarget.ideaId === ideaId && inlineTarget.clipId === clip.id) {
      const durationMs = inlineDuration || Math.round((status.duration ?? 0) * 1000);
      const positionMs = inlinePosition || Math.round((status.currentTime ?? 0) * 1000);
      const atEnd = durationMs > 0 && positionMs >= durationMs - 250;

      try {
        if (status.playing) {
          await player.pause();
          return;
        }

        await activatePlaybackAudioSession();

        if (atEnd) await player.seekTo(0);
        await player.play();
        return;
      } catch (err) {
        console.log("INLINE resume error", err);
        return;
      }
    }

    try {
      if (onBeforePlayNew) await onBeforePlayNew();
      await resetInlinePlayer();

      await activatePlaybackAudioSession();

      await player.replace({ uri: clip.audioUri });
      await player.play();
      setInlineTarget({ ideaId, clipId: clip.id });
    } catch (err) {
      console.log("INLINE play error", err);
    }
  }

  async function seekInline(ms: number) {
    const durationMs = inlineDuration || Math.round((status.duration ?? 0) * 1000);
    const targetMs = Math.max(0, Math.min(ms, durationMs || ms));
    await player.seekTo(targetMs / 1000);
  }

  async function beginInlineScrub() {
    wasPlayingBeforeScrubRef.current = isInlinePlaying;
    scrubPausePromiseRef.current = status.playing ? Promise.resolve(player.pause()) : Promise.resolve();
    try {
      await scrubPausePromiseRef.current;
    } catch (err) {
      console.log("INLINE scrub pause error", err);
    }
  }

  async function endInlineScrub(ms: number) {
    try {
      await scrubPausePromiseRef.current;
    } catch (err) {
      console.log("INLINE scrub pause settle error", err);
    }
    await seekInline(ms);
    if (wasPlayingBeforeScrubRef.current) {
      await player.play();
    }
    wasPlayingBeforeScrubRef.current = false;
    scrubPausePromiseRef.current = null;
  }

  async function cancelInlineScrub() {
    try {
      await scrubPausePromiseRef.current;
    } catch (err) {
      console.log("INLINE scrub cancel settle error", err);
    }
    if (wasPlayingBeforeScrubRef.current) {
      await player.play();
    }
    wasPlayingBeforeScrubRef.current = false;
    scrubPausePromiseRef.current = null;
  }

  return {
    inlineTarget,
    inlinePosition,
    inlineDuration,
    isInlinePlaying,
    toggleInlinePlayback,
    beginInlineScrub,
    endInlineScrub,
    cancelInlineScrub,
    seekInline,
    resetInlinePlayer,
  };
}
