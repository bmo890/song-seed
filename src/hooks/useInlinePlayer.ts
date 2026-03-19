import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipVersion, InlineTarget } from "../types";
import { activateAndPlay, replacePlaybackSource } from "../services/transportPlayback";
import { useStore } from "../state/useStore";

type Args = {
  onBeforePlayNew?: () => Promise<void> | void;
};

let inlinePlayerOwnerIdCounter = 1;
let activeInlinePlayerOwnerId: number | null = null;

export function useInlinePlayer({ onBeforePlayNew }: Args = {}) {
  const [inlineTarget, setInlineTarget] = useState<InlineTarget>(null);
  const wasPlayingBeforeScrubRef = useRef(false);
  const scrubPausePromiseRef = useRef<Promise<void> | null>(null);
  const stopRequestToken = useStore((s) => s.inlineStopRequestToken);
  const toggleRequestToken = useStore((s) => s.inlineToggleRequestToken);
  const setStoreInlineTarget = useStore((s) => s.setInlineTarget);
  const setInlinePlaybackState = useStore((s) => s.setInlinePlaybackState);
  const clearPlayerQueue = useStore((s) => s.clearPlayerQueue);
  const requestPlayerClose = useStore((s) => s.requestPlayerClose);
  const seekRequestToken = useStore((s) => s.inlineSeekRequestToken);
  const seekTargetMs = useStore((s) => s.inlineSeekTargetMs);
  const inlinePlaybackSpeed = useStore((s) => s.inlinePlaybackSpeed);
  const handledStopTokenRef = useRef(stopRequestToken);
  const handledToggleTokenRef = useRef(toggleRequestToken);
  const handledSeekTokenRef = useRef(seekRequestToken);
  const lastAppliedSpeedRef = useRef(inlinePlaybackSpeed);
  const ownerIdRef = useRef(inlinePlayerOwnerIdCounter++);

  const playerOptions = useMemo(() => ({ updateInterval: 100 }), []);
  const player = useAudioPlayer(null, playerOptions);
  const status = useAudioPlayerStatus(player);
  const inlinePosition = Math.round((status.currentTime ?? 0) * 1000);
  const inlineDuration = Math.round((status.duration ?? 0) * 1000);
  const isInlinePlaying = !!status.playing && !status.didJustFinish;

  function claimInlineOwnership() {
    activeInlinePlayerOwnerId = ownerIdRef.current;
  }

  function isInlineOwner() {
    return activeInlinePlayerOwnerId === ownerIdRef.current;
  }

  useEffect(() => {
    if (status.didJustFinish && inlineTarget) {
      if (!isInlineOwner()) return;
      setInlineTarget(null);
    }
  }, [inlineTarget, status.didJustFinish]);

  useEffect(() => {
    if (!isInlineOwner()) return;
    setStoreInlineTarget(inlineTarget);
  }, [inlineTarget, setStoreInlineTarget]);

  useEffect(() => {
    if (!isInlineOwner()) return;
    setInlinePlaybackState({
      positionMs: inlinePosition,
      durationMs: inlineDuration,
      isPlaying: isInlinePlaying,
    });
  }, [inlineDuration, inlinePosition, isInlinePlaying, setInlinePlaybackState]);

  useEffect(() => {
    if (stopRequestToken === handledStopTokenRef.current) return;
    handledStopTokenRef.current = stopRequestToken;
    if (!isInlineOwner()) return;
    void resetInlinePlayer();
  }, [stopRequestToken]);

  useEffect(() => {
    if (toggleRequestToken === handledToggleTokenRef.current) return;
    handledToggleTokenRef.current = toggleRequestToken;
    if (!inlineTarget) return;
    if (!isInlineOwner()) return;
    void toggleActiveInlinePlayback();
  }, [inlineTarget, toggleRequestToken]);

  useEffect(() => {
    if (seekRequestToken === handledSeekTokenRef.current) return;
    handledSeekTokenRef.current = seekRequestToken;
    if (!inlineTarget) return;
    if (!isInlineOwner()) return;
    void seekInline(seekTargetMs);
  }, [seekRequestToken]);

  useEffect(() => {
    if (inlinePlaybackSpeed !== lastAppliedSpeedRef.current) {
      lastAppliedSpeedRef.current = inlinePlaybackSpeed;
      try {
        (player as any).setPlaybackRate?.(inlinePlaybackSpeed);
      } catch {}
    }
  }, [inlinePlaybackSpeed, player]);

  async function resetInlinePlayer() {
    await player.pause();
    scrubPausePromiseRef.current = null;
    wasPlayingBeforeScrubRef.current = false;
    setInlineTarget(null);
    if (isInlineOwner()) {
      setInlinePlaybackState({
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
      });
      activeInlinePlayerOwnerId = null;
    }
  }

  async function toggleActiveInlinePlayback() {
    try {
      if (status.playing) {
        await player.pause();
        return;
      }

      await activateAndPlay(player, status, inlineDuration, inlinePosition);
    } catch (err) {
      console.log("INLINE toggle error", err);
    }
  }

  async function toggleInlinePlayback(ideaId: string, clip: ClipVersion) {
    if (!clip.audioUri) return;

    if (inlineTarget && inlineTarget.ideaId === ideaId && inlineTarget.clipId === clip.id) {
      await toggleActiveInlinePlayback();
      return;
    }

    try {
      claimInlineOwnership();
      requestPlayerClose();
      clearPlayerQueue();
      if (onBeforePlayNew) await onBeforePlayNew();
      await resetInlinePlayer();

      await replacePlaybackSource(player, clip.audioUri, true);
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

  useEffect(() => {
    return () => {
      if (!isInlineOwner()) return;
      activeInlinePlayerOwnerId = null;
      setStoreInlineTarget(null);
      setInlinePlaybackState({
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
      });
      void Promise.resolve(player.pause()).catch(() => {});
    };
  }, [player, setInlinePlaybackState, setStoreInlineTarget]);

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
