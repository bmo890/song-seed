import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSharedAudioRecorder } from "@siteed/audio-studio";
import { PanResponder, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { MiniProgress } from "./MiniProgress";
import { QueuePanel } from "./QueuePanel";
import { TransportBar } from "./common/TransportBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRecordingDisplayElapsed } from "../hooks/useRecordingDisplayElapsed";
import { useFullPlayerContext } from "../hooks/FullPlayerProvider";
import { useStore } from "../state/useStore";
import { styles } from "../styles";
import { fmtDuration } from "../utils";
import { haptic } from "../design/haptics";

type GlobalMediaDockProps = {
  activeRouteName: string;
  /** True while the side drawer is open — the drawer must sit above everything,
   *  so the dock hides entirely rather than floating over it. */
  hidden?: boolean;
  onOpenPlayer: () => void;
  onOpenRecording: () => void;
  /** Navigate to a song/clip page — used by the queue panel's go-to-song action. */
  onOpenIdea: (ideaId: string) => void;
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
  hidden = false,
  onOpenPlayer,
  onOpenRecording,
  onOpenIdea,
}: GlobalMediaDockProps) {
  const insets = useSafeAreaInsets();
  const [queueOpen, setQueueOpen] = useState(false);
  const recorder = useSharedAudioRecorder();
  const recordingIdeaId = useStore((s) => s.recordingIdeaId);
  const workspaces = useStore((s) => s.workspaces);
  const playerTarget = useStore((s) => s.playerTarget);
  const playerPositionMs = useStore((s) => s.playerPositionMs);
  const playerDurationMs = useStore((s) => s.playerDurationMs);
  const playerIsPlaying = useStore((s) => s.playerIsPlaying);
  const isPlayerScreenMounted = useStore((s) => s.isPlayerScreenMounted);
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

  const openFullPlayer = () => {
    useStore.getState().requestInlineStop();
    onOpenPlayer();
  };
  // Swipe UP anywhere on the dock expands to the full player — the mirror of
  // the player header's swipe-down. Vertical-only activation so the scrub bar's
  // horizontal drags are never contested; taps pass through untouched. Declared
  // BEFORE any early return so the hook order is stable across dock states.
  const openFullPlayerRef = useRef(openFullPlayer);
  openFullPlayerRef.current = openFullPlayer;
  const expandGesture = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        gesture.dy < -14 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.4,
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy < -40 || gesture.vy < -0.8) {
          haptic.tap();
          openFullPlayerRef.current();
        }
      },
    })
  ).current;

  // Clear the stored dock height when the queue empties (dock disappears).
  const queueEmpty = playerQueue.length === 0;
  useEffect(() => {
    if (queueEmpty) useStore.getState().setPlayerDockHeight(0);
  }, [queueEmpty]);

  // The queue panel is transient — never leave it open across a session end or
  // while the dock is hidden behind the drawer.
  useEffect(() => {
    if (queueEmpty || hidden) setQueueOpen(false);
  }, [hidden, queueEmpty]);

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
    // The dock yields whenever the PlayerSheet is up — they are the same
    // session at two sizes, never shown together.
    const shouldShowPlaybackDock = !isPlayerScreenMounted;
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

  // The drawer renders beneath root overlays, so the dock yields while it is open.
  if (hidden) return null;

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
                    haptic.grab();
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
                    haptic.tap();
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
                pressed ? styles.pressDownStrong : null,
              ]}
              onPress={(evt) => {
                evt.stopPropagation();
                    haptic.tap();
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

  // Skip the subtitle when it just repeats the title (standalone clip ideas
  // share their clip's name — "Take · Take" reads as a glitch).
  const dockSubtitle = isPreviewingClip
    ? "Preview playing"
    : activePlayback.subtitle !== activePlayback.title
      ? activePlayback.subtitle
      : null;

  return (
    // No `exiting` animation: when the PlayerSheet expands this dock unmounts
    // beneath it instantly — an exit fade would linger under the sheet's
    // slide-up. Hiding instantly is also the natural behavior for the
    // ✕-dismiss and queue-empty cases.
    <Animated.View
      style={styles.miniMediaDockWrap}
      entering={FadeInDown.duration(200)}
    >
      {/* Queue extends upward from the dock — same surface, stays open while
          skipping around. Rendered above the base dock inside the same
          bottom-anchored wrap so extra height grows toward the top. */}
      {queueOpen ? (
        <QueuePanel
          onEndSession={() => {
            setQueueOpen(false);
            void fullPlayer.closePlayer();
            useStore.getState().clearPlayerQueue();
          }}
          onOpenIdea={(ideaId) => {
            // Close the panel so the song page is visible underneath the dock.
            setQueueOpen(false);
            onOpenIdea(ideaId);
          }}
        />
      ) : null}

      <View
        style={[styles.miniMediaDockSurface, safeBottomPadding]}
        // Height of the BASE dock only (queue panel excluded) — page bottom
        // paddings key off this and must not jump when the queue opens.
        onLayout={(e) => useStore.getState().setPlayerDockHeight(e.nativeEvent.layout.height)}
        {...expandGesture.panHandlers}
      >
        {/* Content wrapper dims as a unit during inline preview */}
        <View style={[styles.miniMediaDockContent, isPreviewingClip ? { opacity: 0.45 } : null]}>

          {/* Row 1: title · subtitle [expand] [✕] — every affordance is an
              explicit button; nothing on this surface opens the player by
              accident. Title (the biggest target) expands to the full player;
              the queue toggle lives in the shared transport row below. */}
          <View style={styles.miniMediaDockHeaderRow}>
            <Pressable
              style={styles.miniMediaDockTitlePress}
              onPress={() => {
                haptic.tap();
                openFullPlayer();
              }}
              accessibilityRole="button"
              accessibilityLabel="Open full player"
            >
              <Text style={styles.miniMediaDockTitle} numberOfLines={1}>
                {activePlayback.title}
                {dockSubtitle ? (
                  <Text style={styles.miniMediaDockSubtitle}> · {dockSubtitle}</Text>
                ) : null}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockHeaderBtn,
                pressed ? styles.pressDownStrong : null,
              ]}
              onPress={() => {
                haptic.tap();
                openFullPlayer();
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Expand player"
            >
              <Ionicons name="chevron-up" size={14} color="#6b5a55" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockHeaderBtn,
                pressed ? styles.pressDownStrong : null,
              ]}
              onPress={() => {
                haptic.tap();
                void fullPlayer.closePlayer();
                useStore.getState().clearPlayerQueue();
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <Ionicons name="close" size={14} color="#6b5a55" />
            </Pressable>
          </View>

          {/* Row 2: the SHARED transport row — identical component to the full
              player's control bar (prev/play/next + queue toggle). */}
          <View style={styles.miniMediaDockTransportRow}>
            <TransportBar
              size="compact"
              isPlaying={activePlayback.isPlaying}
              canGoPrevious
              canGoNext={hasNextInQueue}
              onPrevious={handleQueuePrev}
              onTogglePlay={() => {
                if (activePlayback.isPlaying) {
                  void fullPlayer.pausePlayer();
                } else {
                  void fullPlayer.playPlayer();
                }
              }}
              onNext={handleQueueNext}
              trailingIcon="list-outline"
              trailingActive={queueOpen}
              onTrailingPress={() => setQueueOpen((prev) => !prev)}
            />
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
      </View>
    </Animated.View>
  );
}
