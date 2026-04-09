import { useCallback, useEffect, useRef, useState } from "react";

type UsePlayerSpeedControlsArgs = {
  minSpeed: number;
  maxSpeed: number;
  playbackRate: number;
  isPlayerPlaying: boolean;
  pausePlayer: () => Promise<void>;
  playPlayer: () => Promise<void>;
  setPlaybackRate: (rate: number) => void;
};

export function usePlayerSpeedControls({
  minSpeed,
  maxSpeed,
  playbackRate,
  isPlayerPlaying,
  pausePlayer,
  playPlayer,
  setPlaybackRate,
}: UsePlayerSpeedControlsArgs) {
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [speedPanelVisible, setSpeedPanelVisible] = useState(false);
  const speedResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPlayingBeforeSpeedChange = useRef(false);
  const isSlidingSpeed = useRef(false);

  const cleanSpeed = useCallback(
    (value: number) =>
      Math.max(minSpeed, Math.min(maxSpeed, Math.round(value * 20) / 20)),
    [maxSpeed, minSpeed]
  );

  const clearScheduledSpeedResume = useCallback(() => {
    if (speedResumeTimeoutRef.current === null) return;
    clearTimeout(speedResumeTimeoutRef.current);
    speedResumeTimeoutRef.current = null;
  }, []);

  const scheduleSpeedResume = useCallback(() => {
    clearScheduledSpeedResume();
    speedResumeTimeoutRef.current = setTimeout(() => {
      speedResumeTimeoutRef.current = null;
      void playPlayer();
    }, 80);
  }, [clearScheduledSpeedResume, playPlayer]);

  useEffect(() => {
    return () => {
      clearScheduledSpeedResume();
    };
  }, [clearScheduledSpeedResume]);

  useEffect(() => {
    if (isSlidingSpeed.current) {
      return;
    }
    setPlaybackSpeed(cleanSpeed(playbackRate));
  }, [cleanSpeed, playbackRate]);

  const handleSpeedSlideStart = useCallback(() => {
    clearScheduledSpeedResume();
    isSlidingSpeed.current = true;
    wasPlayingBeforeSpeedChange.current = isPlayerPlaying;
    if (isPlayerPlaying) {
      void pausePlayer();
    }
  }, [clearScheduledSpeedResume, isPlayerPlaying, pausePlayer]);

  const handleSpeedSliding = useCallback(
    (value: number) => {
      setPlaybackSpeed(cleanSpeed(value));
    },
    [cleanSpeed]
  );

  const handleSpeedSlideEnd = useCallback(
    (value: number) => {
      const clean = cleanSpeed(value);
      isSlidingSpeed.current = false;
      setPlaybackSpeed(clean);
      setPlaybackRate(clean);
      if (wasPlayingBeforeSpeedChange.current) {
        scheduleSpeedResume();
      }
    },
    [cleanSpeed, scheduleSpeedResume, setPlaybackRate]
  );

  const handleSpeedTap = useCallback(
    (speed: number) => {
      clearScheduledSpeedResume();
      wasPlayingBeforeSpeedChange.current = isPlayerPlaying;
      if (isPlayerPlaying) {
        void pausePlayer();
      }
      setPlaybackSpeed(speed);
      setPlaybackRate(speed);
      if (wasPlayingBeforeSpeedChange.current) {
        scheduleSpeedResume();
      }
    },
    [clearScheduledSpeedResume, isPlayerPlaying, pausePlayer, scheduleSpeedResume, setPlaybackRate]
  );

  return {
    playbackSpeed,
    speedPanelVisible,
    setSpeedPanelVisible,
    handleSpeedSlideStart,
    handleSpeedSliding,
    handleSpeedSlideEnd,
    handleSpeedTap,
  };
}
