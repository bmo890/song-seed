import { LayoutChangeEvent, PanResponder, Text, View } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  /** Hide the built-in current/duration labels (e.g. when the host renders its own). */
  hideTimes?: boolean;
  /** Compact inline usage (clip cards): centers the track inside a symmetric
   *  touch target and tightens the bottom margin, so a `trailingAccessory` lines
   *  up on the track line rather than sitting low. Time labels are unaffected. */
  compact?: boolean;
  /** Optional control rendered to the right of the track, on the SAME row, so it
   *  vertically centers on the track line (the time labels stay above). */
  trailingAccessory?: ReactNode;
  /** Render the elapsed/total labels inline on one row, flanking the track
   *  (elapsed · track · total · accessory), instead of stacked above it. */
  flankTimes?: boolean;
  /** Override the fill + scrub-dot color. Defaults to the global track fill (#111827). */
  accentColor?: string;
};

const EDGE_GRAB_INSET = 10;

export function MiniProgress({
  currentMs,
  durationMs,
  onSeek,
  onSeekStart,
  onSeekCancel,
  showTopDivider = false,
  extraBottomMargin = 0,
  captureWholeLane = false,
  hideTimes = false,
  compact = false,
  trailingAccessory,
  flankTimes = false,
  accentColor,
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

  const getSeekTime = (pageX: number, fallbackMs = displayMs) => {
    if (trackFrame.width <= 0) return fallbackMs;
    const effectiveWidth = Math.max(1, trackFrame.width - EDGE_GRAB_INSET * 2);
    const trackRelativeX = pageX - (trackFrame.pageX + EDGE_GRAB_INSET);
    const ratio = Math.max(0, Math.min(1, trackRelativeX / effectiveWidth));
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

  // The track shares a row with siblings (times and/or an accessory) whenever it
  // flanks its labels or carries a trailing control — it flexes to fill the rest.
  const inRow = flankTimes || trailingAccessory != null;

  const trackHitbox = (
    <View
      ref={trackRef}
      onLayout={handleTrackLayout}
      style={[
        styles.miniProgressTrackHitbox,
        { paddingHorizontal: EDGE_GRAB_INSET },
        // Symmetric vertical padding keeps the same 20px touch height as the
        // default (4 + 12) but centers the track within it, so a trailing
        // accessory on this row lines up on the track line.
        compact ? { paddingTop: 8, paddingBottom: 8 } : null,
        captureWholeLane ? { minHeight: 24, justifyContent: "center" } : null,
        inRow ? styles.miniProgressTrackHitboxFlex : null,
      ]}
      {...(!captureWholeLane ? responderHandlers : {})}
    >
      <View style={styles.miniProgressTrack}>
        <View
          style={[
            styles.miniProgressFill,
            { width: `${clamped * 100}%` },
            accentColor ? { backgroundColor: accentColor } : null,
          ]}
        />
        <View
          style={[
            styles.miniProgressDot,
            { left: `${clamped * 100}%` },
            accentColor ? { backgroundColor: accentColor } : null,
          ]}
        />
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.miniProgressWrap,
        compact ? { marginBottom: 0 } : null,
        extraBottomMargin ? { paddingBottom: extraBottomMargin } : null,
      ]}
      {...(captureWholeLane ? responderHandlers : {})}
    >
      {showTopDivider ? <View style={styles.miniProgressTopDivider} /> : null}
      {hideTimes || flankTimes ? null : (
        <View style={styles.miniProgressTimes}>
          <Text style={styles.miniProgressTime}>{fmtDuration(displayMs)}</Text>
          <Text style={styles.miniProgressTime}>{fmtDuration(durationMs || 0)}</Text>
        </View>
      )}
      {flankTimes ? (
        <View style={styles.miniProgressTrackRow}>
          <Text style={[styles.miniProgressTime, styles.miniProgressTimeFlankStart]}>
            {fmtDuration(displayMs)}
          </Text>
          {trackHitbox}
          <Text style={[styles.miniProgressTime, styles.miniProgressTimeFlankEnd]}>
            {fmtDuration(durationMs || 0)}
          </Text>
          {trailingAccessory ?? null}
        </View>
      ) : trailingAccessory ? (
        <View style={styles.miniProgressTrackRow}>
          {trackHitbox}
          {trailingAccessory}
        </View>
      ) : (
        trackHitbox
      )}
    </View>
  );
}
