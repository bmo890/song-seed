import { useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSharedAudioRecorder } from "@siteed/audio-studio";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { MiniProgress } from "./MiniProgress";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRecordingDisplayElapsed } from "../hooks/useRecordingDisplayElapsed";
import { useFullPlayerContext } from "../hooks/FullPlayerProvider";
import { useStore } from "../state/useStore";
import { styles } from "../styles";
import { fmtDuration } from "../utils";

type GlobalMediaDockProps = {
  activeRouteName: string;
  onOpenPlayer: () => void;
  onOpenRecording: () => void;
};

type PlaybackDockState = {
  ideaId: string;
  clipId: string;
  title: string;
  subtitle: string;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
};

export function GlobalMediaDock({
  activeRouteName,
  onOpenPlayer,
  onOpenRecording,
}: GlobalMediaDockProps) {
  const insets = useSafeAreaInsets();
  const recorder = useSharedAudioRecorder();
  const recordingIdeaId = useStore((s) => s.recordingIdeaId);
  const workspaces = useStore((s) => s.workspaces);
  const playerTarget = useStore((s) => s.playerTarget);
  const playerPositionMs = useStore((s) => s.playerPositionMs);
  const playerDurationMs = useStore((s) => s.playerDurationMs);
  const playerIsPlaying = useStore((s) => s.playerIsPlaying);
  const isPlayerScreenMounted = useStore((s) => s.isPlayerScreenMounted);
  const playerDockPresentationHold = useStore((s) => s.playerDockPresentationHold);
  const inlineTarget = useStore((s) => s.inlineTarget);
  const inlineIsPlaying = useStore((s) => s.inlineIsPlaying);
  const recordingElapsedMs = useRecordingDisplayElapsed({
    durationMs: recorder.durationMs,
    isRecording: recorder.isRecording,
    isPaused: recorder.isPaused,
  });

  const allIdeas = workspaces.flatMap((workspace) => workspace.ideas);
  const recordingIdea = recordingIdeaId
    ? allIdeas.find((idea) => idea.id === recordingIdeaId) ?? null
    : null;
  const hasRecordingSession =
    !!recordingIdea && (recorder.isRecording || recorder.isPaused);

  const playerQueue = useStore((s) => s.playerQueue);
  const playerQueueIndex = useStore((s) => s.playerQueueIndex);
  const fullPlayer = useFullPlayerContext();
  const isPreviewingClip = !!inlineTarget && inlineIsPlaying && !!playerTarget && !playerIsPlaying;

  const hasNextInQueue = playerQueue.length > 0 && playerQueueIndex < playerQueue.length - 1;
  const hasPrevInQueue = playerQueueIndex > 0;
  const prevTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the stored dock height when the queue empties (dock disappears).
  const queueEmpty = playerQueue.length === 0;
  useEffect(() => {
    if (queueEmpty) useStore.getState().setPlayerDockHeight(0);
  }, [queueEmpty]);

  const handleQueueNext = () => {
    if (!hasNextInQueue) return;
    useStore.getState().requestInlineStop();
    useStore.getState().advancePlayerQueue("next", true);
  };

  // Single tap restarts the current clip; double-tap jumps to the previous one
  // (or just restarts if already the first clip in the queue).
  const handleQueuePrev = () => {
    useStore.getState().requestInlineStop();
    if (prevTapTimeoutRef.current) {
      clearTimeout(prevTapTimeoutRef.current);
      prevTapTimeoutRef.current = null;
      if (hasPrevInQueue) {
        useStore.getState().advancePlayerQueue("previous", true);
      } else {
        void fullPlayer.seekTo(0);
      }
      return;
    }
    prevTapTimeoutRef.current = setTimeout(() => {
      prevTapTimeoutRef.current = null;
      void fullPlayer.seekTo(0);
    }, 280);
  };

  // The dock only represents the durable full-player queue/session. Clip-card
  // preview playback is separate and does not take over the dock UI.
  const activePlayback: PlaybackDockState | null = (() => {
    // Clip-card opens suppress the dock before navigation. Maximizing the existing dock
    // holds it through the Player fade so the underlying collection never flashes through.
    const shouldShowPlaybackDock =
      playerDockPresentationHold ||
      (activeRouteName !== "Player" && !isPlayerScreenMounted);
    if (playerTarget && playerQueue.length > 0 && shouldShowPlaybackDock) {
      const idea = allIdeas.find((item) => item.id === playerTarget.ideaId);
      const clip = idea?.clips.find((item) => item.id === playerTarget.clipId);
      if (idea && clip) {
        return {
          ideaId: idea.id,
          clipId: clip.id,
          title: clip.title,
          subtitle: idea.title,
          isPlaying: playerIsPlaying,
          positionMs: playerPositionMs,
          durationMs: playerDurationMs || clip.durationMs || 0,
        } satisfies PlaybackDockState;
      }
    }
    return null;
  })();

  const activeSelectionDockHeight = useStore((s) => s.activeSelectionDockHeight);
  const safeBottomPadding = { paddingBottom: Math.max(insets.bottom, 14) };

  // ─── Recording session dock ─────────────────────────────────────────────────
  if (activeRouteName !== "Recording" && hasRecordingSession && recordingIdea) {
    return (
      <Animated.View
        style={styles.miniMediaDockWrap}
        entering={FadeInDown.duration(200)}
        exiting={FadeOut.duration(150)}
      >
        <Pressable
          style={[styles.miniMediaDockSurface, styles.miniMediaDockSurfaceRecording, safeBottomPadding]}
          onPress={onOpenRecording}
        >
          <View style={styles.miniMediaDockContent}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={styles.miniMediaDockRecordingCopy}>
                <View style={styles.miniMediaDockRecordingBadge}>
                  <View
                    style={[
                      styles.miniMediaDockRecordingDot,
                      recorder.isPaused ? styles.miniMediaDockRecordingDotPaused : null,
                    ]}
                  />
                  <Text style={styles.miniMediaDockRecordingBadgeText}>
                    {recorder.isPaused ? "Paused" : "Recording"}
                  </Text>
                </View>
                <Text style={styles.miniMediaDockRecordingTitle} numberOfLines={1}>
                  {recordingIdea.title || "Recording"}
                </Text>
              </View>

              <View style={styles.miniMediaDockRecordingActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.miniMediaDockRecordingBtn,
                    pressed ? styles.pressDownStrong : null,
                  ]}
                  onPress={(evt) => {
                    evt.stopPropagation();
                    if (recorder.isPaused) {
                      void recorder.resumeRecording();
                    } else {
                      void recorder.pauseRecording();
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={recorder.isPaused ? "Resume recording" : "Pause recording"}
                >
                  <Ionicons
                    name={recorder.isPaused ? "mic" : "pause"}
                    size={18}
                    color="#7f1d1d"
                  />
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.miniMediaDockRecordingBtn,
                    styles.miniMediaDockRecordingStopBtn,
                    pressed ? styles.pressDownStrong : null,
                  ]}
                  onPress={(evt) => {
                    evt.stopPropagation();
                    useStore.getState().requestRecordingSave();
                    onOpenRecording();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Save recording"
                >
                  <Ionicons name="square" size={16} color="#ffffff" />
                </Pressable>
              </View>
            </View>

            <View style={styles.miniMediaDockRecordingFooter}>
              <Text style={styles.miniMediaDockRecordingTime}>{fmtDuration(recordingElapsedMs)}</Text>
              <Text style={styles.miniMediaDockHintText}>Tap to reopen controls</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  // ─── Playback dock ──────────────────────────────────────────────────────────
  if (!activePlayback) return null;

  // While a selection toolbar is on screen, slim the dock to a quiet strip
  // that tucks tight above it: thin progress line + play/pause + title.
  if (activeSelectionDockHeight > 0) {
    const pct = activePlayback.durationMs > 0
      ? Math.max(0, Math.min(1, activePlayback.positionMs / activePlayback.durationMs))
      : 0;
    return (
      <Animated.View
        style={[styles.miniMediaDockWrap, { bottom: activeSelectionDockHeight }]}
        entering={FadeIn.duration(160)}
      >
        <Pressable
          style={styles.miniMediaDockCompact}
          onLayout={(e) => useStore.getState().setPlayerDockHeight(e.nativeEvent.layout.height)}
          onPress={() => {
            useStore.getState().requestInlineStop();
            onOpenPlayer();
          }}
        >
          <View style={styles.miniMediaDockCompactTrack}>
            <View style={[styles.miniMediaDockCompactFill, { width: `${pct * 100}%` }]} />
          </View>
          <View style={styles.miniMediaDockCompactRow}>
            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockCompactPlayBtn,
                pressed ? { opacity: 0.82 } : null,
              ]}
              onPress={(evt) => {
                evt.stopPropagation();
                if (activePlayback.isPlaying) {
                  void fullPlayer.pausePlayer();
                } else {
                  void fullPlayer.playPlayer();
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={activePlayback.isPlaying ? "Pause" : "Play"}
            >
              <Ionicons
                name={activePlayback.isPlaying ? "pause" : "play"}
                size={16}
                color="#FDFBF7"
              />
            </Pressable>
            <Text style={styles.miniMediaDockTitle} numberOfLines={1}>
              {activePlayback.title}
              <Text style={styles.miniMediaDockSubtitle}> · {activePlayback.subtitle}</Text>
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    // No `exiting` animation: when opening the full player the route flips to "Player"
    // and this dock unmounts. A reanimated exit fade would linger ~150ms into the player's
    // fade-in transition, briefly showing the dock over the opening player. Hiding instantly
    // is also the natural behavior for the ✕-dismiss and queue-empty cases.
    <Animated.View
      style={styles.miniMediaDockWrap}
      entering={FadeInDown.duration(200)}
    >
      <Pressable
        style={[styles.miniMediaDockSurface, safeBottomPadding]}
        onLayout={(e) => useStore.getState().setPlayerDockHeight(e.nativeEvent.layout.height)}
        onPress={() => {
          useStore.getState().requestInlineStop();
          onOpenPlayer();
        }}
      >
        {/* ✕ Dismiss — absolute top-right, outside content wrapper so it
            stays fully visible even when content dims for preview state */}
        <Pressable
          style={styles.miniMediaDockCloseBtn}
          onPress={(evt) => {
            evt.stopPropagation();
            void fullPlayer.closePlayer();
            useStore.getState().clearPlayerQueue();
          }}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Ionicons name="close" size={13} color="#6b5a55" />
        </Pressable>

        {/* Content wrapper dims as a unit during inline preview */}
        <View style={[styles.miniMediaDockContent, isPreviewingClip ? { opacity: 0.45 } : null]}>

          {/* Row 1: bold title + muted subtitle on one line — padded to clear the ✕ */}
          <View style={styles.miniMediaDockTitleRow}>
            <Text style={styles.miniMediaDockTitle} numberOfLines={1}>
              {activePlayback.title}
              <Text style={styles.miniMediaDockSubtitle}>
                {isPreviewingClip
                  ? " · Preview playing"
                  : ` · ${activePlayback.subtitle}`}
              </Text>
            </Text>
          </View>

          {/* Row 2: transport — centered ⏮  ●●  ⏭ */}
          <View style={styles.miniMediaDockTransportRow}>
            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockSkipBtn,
                pressed ? styles.pressDownStrong : null,
              ]}
              onPress={(evt) => {
                evt.stopPropagation();
                handleQueuePrev();
              }}
              accessibilityRole="button"
              accessibilityLabel="Restart, double-tap for previous"
            >
              <Ionicons name="play-skip-back" size={18} color="#6b5a55" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockPlayBtn,
                pressed ? { opacity: 0.82 } : null,
              ]}
              onPress={(evt) => {
                evt.stopPropagation();
                if (activePlayback.isPlaying) {
                  void fullPlayer.pausePlayer();
                } else {
                  void fullPlayer.playPlayer();
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={activePlayback.isPlaying ? "Pause" : "Play"}
            >
              <Ionicons
                name={activePlayback.isPlaying ? "pause" : "play"}
                size={20}
                color="#FDFBF7"
              />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockSkipBtn,
                !hasNextInQueue ? { opacity: 0.3 } : null,
                pressed && hasNextInQueue ? styles.pressDownStrong : null,
              ]}
              disabled={!hasNextInQueue}
              onPress={(evt) => {
                evt.stopPropagation();
                handleQueueNext();
              }}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              <Ionicons name="play-skip-forward" size={18} color="#6b5a55" />
            </Pressable>
          </View>

          {/* Rows 3+4: times directly above scrub — MiniProgress renders both */}
          <MiniProgress
            accentColor="#824f3f"
            currentMs={activePlayback.positionMs}
            durationMs={activePlayback.durationMs}
            onSeek={(ms) => {
              useStore.getState().requestInlineStop();
              void fullPlayer.seekTo(ms);
            }}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}
