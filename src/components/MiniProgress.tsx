import { LayoutChangeEvent, PanResponder, Text, View } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const trackRef = useRef<View | null>(null);
  const [trackFrame, setTrackFrame] = useState({ pageX: 0, width: 0 });
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

  const measureTrackFrame = useCallback(() => {
    trackRef.current?.measureInWindow((pageX, _pageY, width) => {
      setTrackFrame((prev) =>
        prev.pageX === pageX && prev.width === width ? prev : { pageX, width }
      );
    });
  }, []);

  const handleTrackLayout = (_evt: LayoutChangeEvent) => {
    requestAnimationFrame(measureTrackFrame);
  };

  const getSeekTime = (pageX: number) => {
    if (trackFrame.width <= 0) return 0;
    const trackRelativeX = pageX - trackFrame.pageX;
    const ratio = Math.max(0, Math.min(1, trackRelativeX / trackFrame.width));
    return ratio * safeDuration;
  };

  const updateDragPosition = (pageX: number) => {
    if (!onSeek) return;
    setDragMs(getSeekTime(pageX));
  };

  const beginDrag = (pageX: number) => {
    if (!onSeek) return;
    setIsCommitPending(false);
    measureTrackFrame();
    void onSeekStart?.();
    updateDragPosition(pageX);
  };

  const commitSeek = (pageX: number) => {
    if (!onSeek) return;
    const nextMs = getSeekTime(pageX);
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
        onPanResponderGrant: (evt) => beginDrag(evt.nativeEvent.pageX),
        onPanResponderMove: (evt) => updateDragPosition(evt.nativeEvent.pageX),
        onPanResponderRelease: (evt) => commitSeek(evt.nativeEvent.pageX),
        onPanResponderTerminate: () => {
          setDragMs(null);
          setIsCommitPending(false);
          void onSeekCancel?.();
        },
      }),
    [beginDrag, commitSeek, onSeek, onSeekCancel, updateDragPosition]
  );

  const responderHandlers = onSeek ? panResponder.panHandlers : {};

  return (
    <View
      style={[styles.miniProgressWrap, extraBottomMargin ? { paddingBottom: extraBottomMargin } : null]}
    >
      {showTopDivider ? <View style={styles.miniProgressTopDivider} /> : null}
      <View style={styles.miniProgressTimes}>
        <Text style={styles.miniProgressTime}>{fmtDuration(displayMs)}</Text>
        <Text style={styles.miniProgressTime}>{fmtDuration(durationMs || 0)}</Text>
      </View>
      <View
        ref={trackRef}
        onLayout={handleTrackLayout}
        style={[
          styles.miniProgressTrackHitbox,
          captureWholeLane ? { minHeight: 24, justifyContent: "center" } : null,
        ]}
        {...responderHandlers}
      >
        <View style={styles.miniProgressTrack}>
          <View style={[styles.miniProgressFill, { width: `${clamped * 100}%` }]} />
          <View style={[styles.miniProgressDot, { left: `${clamped * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}
