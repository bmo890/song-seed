import { useCallback, useEffect, useRef, useState } from "react";

type UsePlayerSpeedControlsArgs = {
  minSpeed: number;
  maxSpeed: number;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
};

export function usePlayerSpeedControls({
  minSpeed,
  maxSpeed,
  playbackRate,
  setPlaybackRate,
}: UsePlayerSpeedControlsArgs) {
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [speedPanelVisible, setSpeedPanelVisible] = useState(false);
  const isSlidingSpeed = useRef(false);

  const cleanSpeed = useCallback(
    (value: number) =>
      Math.max(minSpeed, Math.min(maxSpeed, Math.round(value * 20) / 20)),
    [maxSpeed, minSpeed]
  );

  useEffect(() => {
    if (isSlidingSpeed.current) {
      return;
    }
    // A non-positive rate is not a slow speed, it's an idle transport reporting
    // nothing. Clamping it would silently show the floor (0.5×) as the chosen
    // speed; ignoring it leaves the dial on the last real value.
    if (!Number.isFinite(playbackRate) || playbackRate <= 0) {
      return;
    }
    setPlaybackSpeed(cleanSpeed(playbackRate));
  }, [cleanSpeed, playbackRate]);

  // Speed changes are heard live (2026-10-21). They used to pause the take and
  // resume 80 ms later, which read as a stutter on every change; both engines
  // take a new rate while playing, and a slide commits only once, on release.
  const handleSpeedSlideStart = useCallback(() => {
    isSlidingSpeed.current = true;
  }, []);

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
    },
    [cleanSpeed, setPlaybackRate]
  );

  const handleSpeedTap = useCallback(
    (speed: number) => {
      setPlaybackSpeed(speed);
      setPlaybackRate(speed);
    },
    [setPlaybackRate]
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
