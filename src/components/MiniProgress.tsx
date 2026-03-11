import { LayoutChangeEvent, PanResponder, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { styles } from "../styles";
import { fmtDuration } from "../utils";

type Props = {
  currentMs: number;
  durationMs: number;
  onSeek?: (ms: number) => void | Promise<void>;
  onSeekStart?: () => void | Promise<void>;
  onSeekCancel?: () => void | Promise<void>;
  showTopDivider?: boolean;
  extraBottomMargin?: number;
  captureWholeLane?: boolean;
};

export function MiniProgress({
  currentMs,
  durationMs,
  onSeek,
  onSeekStart,
  onSeekCancel,
  showTopDivider = false,
  extraBottomMargin = 0,
  captureWholeLane = false,
}: Props) {
  const safeDuration = durationMs || 1;
  const [trackFrame, setTrackFrame] = useState({ x: 0, width: 0 });
  const [dragMs, setDragMs] = useState<number | null>(null);
  const [isCommitPending, setIsCommitPending] = useState(false);

  const displayMs = dragMs ?? currentMs;
  const clamped = Math.max(0, Math.min(1, displayMs / safeDuration));

  useEffect(() => {
    if (dragMs === null) return;
    if (!isCommitPending) return;
    if (Math.abs(currentMs - dragMs) > 160) return;
    setDragMs(null);
    setIsCommitPending(false);
  }, [currentMs, dragMs, isCommitPending]);

  const handleTrackLayout = (evt: LayoutChangeEvent) => {
    const { x, width } = evt.nativeEvent.layout;
    setTrackFrame((prev) => (prev.x === x && prev.width === width ? prev : { x, width }));
  };

  const getSeekTime = (locationX: number) => {
    if (trackFrame.width <= 0) return 0;
    const trackRelativeX = captureWholeLane ? locationX - trackFrame.x : locationX;
    const ratio = Math.max(0, Math.min(1, trackRelativeX / trackFrame.width));
    return ratio * safeDuration;
  };

  const updateDragPosition = (locationX: number) => {
    if (!onSeek) return;
    setDragMs(getSeekTime(locationX));
  };

  const beginDrag = (locationX: number) => {
    if (!onSeek) return;
    setIsCommitPending(false);
    void onSeekStart?.();
    updateDragPosition(locationX);
  };

  const commitSeek = (locationX: number) => {
    if (!onSeek) return;
    const nextMs = getSeekTime(locationX);
    setDragMs(nextMs);
    setIsCommitPending(true);
    void Promise.resolve(onSeek(nextMs)).catch(() => {
      setDragMs(null);
      setIsCommitPending(false);
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!onSeek,
        onMoveShouldSetPanResponder: () => !!onSeek,
        onStartShouldSetPanResponderCapture: () => !!onSeek,
        onMoveShouldSetPanResponderCapture: () => !!onSeek,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (evt) => beginDrag(evt.nativeEvent.locationX),
        onPanResponderMove: (evt) => updateDragPosition(evt.nativeEvent.locationX),
        onPanResponderRelease: (evt) => commitSeek(evt.nativeEvent.locationX),
        onPanResponderTerminate: () => {
          setDragMs(null);
          setIsCommitPending(false);
          void onSeekCancel?.();
        },
      }),
    [captureWholeLane, onSeek, onSeekCancel, onSeekStart, safeDuration, trackFrame.width, trackFrame.x]
  );

  const responderHandlers = onSeek ? panResponder.panHandlers : {};

  return (
    <View
      style={[styles.miniProgressWrap, extraBottomMargin ? { paddingBottom: extraBottomMargin } : null]}
      {...(captureWholeLane ? responderHandlers : {})}
    >
      {showTopDivider ? <View style={styles.miniProgressTopDivider} /> : null}
      <View style={styles.miniProgressTimes}>
        <Text style={styles.miniProgressTime}>{fmtDuration(displayMs)}</Text>
        <Text style={styles.miniProgressTime}>{fmtDuration(durationMs || 0)}</Text>
      </View>
      <View
        onLayout={handleTrackLayout}
        style={styles.miniProgressTrackHitbox}
        {...(!captureWholeLane ? responderHandlers : {})}
      >
        <View style={styles.miniProgressTrack}>
          <View style={[styles.miniProgressFill, { width: `${clamped * 100}%` }]} />
          <View style={[styles.miniProgressDot, { left: `${clamped * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}
