import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSharedAudioRecorder } from "@siteed/audio-studio";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut, runOnJS, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { QueuePanel } from "./QueuePanel";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRecordingDisplayElapsed } from "../hooks/useRecordingDisplayElapsed";
import { useFullPlayerControls } from "../hooks/FullPlayerProvider";
import { usePlayerSheetPosition } from "../hooks/PlayerSheetPositionProvider";
import { useStore } from "../state/useStore";
import { styles } from "../styles";
import { fmtDuration, getCollectionById } from "../utils";
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
  /** Clip's own duration — the progress leaf falls back to this until the live
   *  transport duration arrives. */
  fallbackDurationMs: number;
};

/**
 * The live progress hairline, isolated so the ~20Hz position/duration ticks
 * re-render ONLY this tiny leaf — never the dock shell (which does workspace
 * lookups) or its swipe gesture. This is what keeps drags/scrolls/the drawer
 * smooth while audio plays.
 */
const DockProgressTrack = memo(function DockProgressTrack({
  fallbackDurationMs,
}: {
  fallbackDurationMs: number;
}) {
  const positionMs = useStore((s) => s.playerPositionMs);
  const durationMs = useStore((s) => s.playerDurationMs);
  const total = durationMs || fallbackDurationMs || 0;
  const pct = total > 0 ? Math.max(0, Math.min(1, positionMs / total)) : 0;
  return (
    <View style={styles.miniMediaDockProgressTrack}>
      <View style={[styles.miniMediaDockProgressFill, { width: `${pct * 100}%` }]} />
    </View>
  );
});

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
  // NOTE: position/duration are deliberately NOT subscribed here — they tick at
  // ~20Hz during playback and would re-render the whole dock (including the
  // workspace.find lookups below) every 50ms, janking any concurrent drag /
  // scroll / drawer animation. The live progress bar is isolated into the
  // DockProgressTrack leaf so only it re-renders on each tick.
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
  const fullPlayer = useFullPlayerControls();
  const isPreviewingClip = !!inlineTarget && inlineIsPlaying && !!playerTarget && !playerIsPlaying;

  const hasNextInQueue = playerQueue.length > 0 && playerQueueIndex < playerQueue.length - 1;
  const hasPrevInQueue = playerQueue.length > 0 && playerQueueIndex > 0;
  // Show the "n / n" position readout only for a real multi-item queue. The queue
  // button itself is ALWAYS enabled (even for a single item) — disabling it caused
  // edge-case bugs, and opening a one-item queue to reorder/remove is valid.
  const hasQueueCount = playerQueue.length > 1;

  const { dragY, dockedY, openedByDrag, setInMotion, screenHeight } = usePlayerSheetPosition();

  const openFullPlayer = () => {
    useStore.getState().requestInlineStop();
    onOpenPlayer();
  };

  // The sheet is PRE-MOUNTED docked (PlayerSheet renders it whenever a session
  // is active), so swipe-up just drives its position — no mount to wait for, the
  // reveal is instant. These JS entry points are stable (they only touch the
  // store getState + the stable setInMotion), so the once-created gesture can
  // capture them directly — no mutating ref (which Reanimated rejects once the
  // object has been serialized into a worklet). Freezing keeps the rise smooth.
  const beginSwipeUp = useCallback(() => {
    useStore.getState().requestInlineStop();
    setInMotion(true);
  }, [setInMotion]);
  const finishSwipeUpOpen = useCallback(() => {
    useStore.getState().setPlayerScreenMounted(true);
    setInMotion(false);
  }, [setInMotion]);
  const endSwipeUpCancel = useCallback(() => setInMotion(false), [setInMotion]);

  // Swipe UP on the dock pulls the pre-mounted player up, tracking the finger.
  // Vertical-up only, so the scrub bar's horizontal drags and button taps are
  // never contested. Declared before any early return so hook order is stable.
  const expandGesture = useRef(
    Gesture.Pan()
      .activeOffsetY(-12)
      .failOffsetY(12)
      .onStart(() => {
        "worklet";
        runOnJS(beginSwipeUp)();
      })
      .onUpdate((event) => {
        "worklet";
        // Track from the docked offset (sheet top at the dock's top edge), so the
        // sheet lifts out from behind the dock the instant the finger moves.
        dragY.value = Math.min(dockedY.value, Math.max(0, dockedY.value + event.translationY));
      })
      .onEnd((event) => {
        "worklet";
        const opened = event.translationY < -screenHeight * 0.2 || event.velocityY < -900;
        if (opened) {
          // Tell the sheet the finger already positioned it, so its expand effect
          // doesn't re-animate from the top.
          openedByDrag.value = true;
          dragY.value = withTiming(0, { duration: 220 }, (finished) => {
            if (finished) runOnJS(finishSwipeUpOpen)();
          });
        } else {
          dragY.value = withTiming(dockedY.value, { duration: 200 }, (finished) => {
            if (finished) runOnJS(endSwipeUpCancel)();
          });
        }
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

  const handleQueuePrev = () => {
    if (!hasPrevInQueue) return;
    useStore.getState().requestInlineStop();
    useStore.getState().advancePlayerQueue("previous", true);
  };

  // The dock only represents the durable full-player queue/session. Clip-card
  // preview playback is separate and does not take over the dock UI.
  const activePlayback: PlaybackDockState | null = (() => {
    // The dock shows whenever the sheet is docked (not expanded). During a
    // swipe-up drag "expanded" stays false until release, so the dock naturally
    // stays mounted behind the rising sheet, keeping its gesture alive.
    const shouldShowPlaybackDock = !isPlayerScreenMounted;
    if (playerTarget && playerQueue.length > 0 && shouldShowPlaybackDock) {
      const workspace = workspaces.find((ws) =>
        ws.ideas.some((item) => item.id === playerTarget.ideaId)
      );
      const idea = workspace?.ideas.find((item) => item.id === playerTarget.ideaId);
      const clip = idea?.clips.find((item) => item.id === playerTarget.clipId);
      if (workspace && idea && clip) {
        // Context line (the "artist" slot): song title when the clip belongs to
        // a song project, then the collection — so standalone clips aren't bare.
        const collectionTitle = getCollectionById(workspace, idea.collectionId)?.title;
        const subtitle =
          idea.kind === "project"
            ? [idea.title, collectionTitle].filter(Boolean).join(" · ")
            : collectionTitle ?? idea.title;
        return {
          ideaId: idea.id,
          clipId: clip.id,
          title: clip.title,
          subtitle,
          isPlaying: playerIsPlaying,
          fallbackDurationMs: clip.durationMs || 0,
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

  // Skip the subtitle when it just repeats the title (standalone clip ideas
  // share their clip's name — "Take · Take" reads as a glitch).
  const dockSubtitle = isPreviewingClip
    ? "Preview playing"
    : activePlayback.subtitle !== activePlayback.title
      ? activePlayback.subtitle
      : null;
  // Lifted above an active selection toolbar; hugging the screen bottom otherwise.
  const dockBottomOffset = activeSelectionDockHeight > 0 ? { bottom: activeSelectionDockHeight } : null;
  // This wins over miniMediaDockSurface's own paddingBottom (later in the style
  // array), so the stylesheet value has no effect here — bumping the dock's
  // height/balance has to happen here, not there.
  const dockBottomPadding = {
    paddingBottom: activeSelectionDockHeight > 0 ? 10 : Math.max(insets.bottom, 14),
  };

  return (
    // No `exiting` animation: when the PlayerSheet expands this dock unmounts
    // beneath it instantly — an exit fade would linger under the sheet's
    // slide-up. Hiding instantly is also the natural behavior for the
    // ✕-dismiss and queue-empty cases.
    <Animated.View
      style={[styles.miniMediaDockWrap, dockBottomOffset]}
      entering={FadeInDown.duration(200)}
    >
      {/* Queue extends upward from the dock — same surface, stays open while
          skipping around. Rendered above the base dock inside the same
          bottom-anchored wrap so extra height grows toward the top. */}
      {queueOpen ? (
        <QueuePanel
          onOpenIdea={(ideaId) => {
            // Close the panel so the song page is visible underneath the dock.
            setQueueOpen(false);
            onOpenIdea(ideaId);
          }}
        />
      ) : null}

      <GestureDetector gesture={expandGesture}>
      <View
        style={[styles.miniMediaDockSurface, dockBottomPadding]}
        // Height of the BASE dock only (queue panel excluded) — page bottom
        // paddings key off this and must not jump when the queue opens.
        onLayout={(e) => useStore.getState().setPlayerDockHeight(e.nativeEvent.layout.height)}
      >
        {/* Hairline progress along the dock's top edge — isolated leaf so the
            20Hz position ticks don't re-render the dock shell. */}
        <DockProgressTrack fallbackDurationMs={activePlayback.fallbackDurationMs} />

        {/* One row: [ ✕ ] [ title·context …flex… ] [ ◀ ▶ ▶▶ ] [ ≡ + n/n ].
            ✕ anchors far left, the title fills the slack, prev/play/next form a
            tight transport cluster, and the queue button (with its position
            readout beneath) closes the right. */}
        <View style={styles.miniMediaDockRow}>
          <Pressable
            style={({ pressed }) => [styles.miniMediaDockDismissBtn, pressed ? styles.pressDownStrong : null]}
            onPress={() => {
              haptic.tap();
              void fullPlayer.closePlayer();
              useStore.getState().clearPlayerQueue();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Ionicons name="close" size={15} color="rgba(253,251,247,0.6)" />
          </Pressable>

          <Pressable
            style={[styles.miniMediaDockTitlePress, isPreviewingClip ? { opacity: 0.45 } : null]}
            onPress={() => {
              haptic.tap();
              openFullPlayer();
            }}
            accessibilityRole="button"
            accessibilityLabel="Open full player"
          >
            <Text style={styles.miniMediaDockTitle} numberOfLines={1}>
              {activePlayback.title}
            </Text>
            {dockSubtitle ? (
              <Text style={styles.miniMediaDockSubtitle} numberOfLines={1}>
                {dockSubtitle}
              </Text>
            ) : null}
          </Pressable>

          <View style={styles.miniMediaDockTransport}>
            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockSkipBtn,
                !hasPrevInQueue ? { opacity: 0.3 } : null,
                pressed && hasPrevInQueue ? styles.pressDownStrong : null,
              ]}
              disabled={!hasPrevInQueue}
              onPress={() => {
                haptic.tap();
                handleQueuePrev();
              }}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Previous"
            >
              <Ionicons name="play-skip-back" size={16} color="rgba(253,251,247,0.82)" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockPlayBtn,
                pressed ? styles.pressDownStrong : null,
              ]}
              onPress={() => {
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
                size={17}
                color="#8b4f3b"
                style={activePlayback.isPlaying ? null : { marginLeft: 2 }}
              />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockSkipBtn,
                !hasNextInQueue ? { opacity: 0.3 } : null,
                pressed && hasNextInQueue ? styles.pressDownStrong : null,
              ]}
              disabled={!hasNextInQueue}
              onPress={() => {
                haptic.tap();
                handleQueueNext();
              }}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              <Ionicons name="play-skip-forward" size={16} color="rgba(253,251,247,0.82)" />
            </Pressable>
          </View>

          <View style={styles.miniMediaDockQueueCol}>
            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockHeaderBtn,
                queueOpen ? styles.miniMediaDockHeaderBtnActive : null,
                pressed ? styles.pressDownStrong : null,
              ]}
              onPress={() => {
                haptic.tap();
                setQueueOpen((prev) => !prev);
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={queueOpen ? "Hide queue" : "Show queue"}
            >
              <Ionicons name="list" size={15} color={queueOpen ? "#8b4f3b" : "#FDFBF7"} />
            </Pressable>
            {hasQueueCount ? (
              <Text style={styles.miniMediaDockQueueCount}>
                {Math.min(playerQueueIndex + 1, playerQueue.length)}/{playerQueue.length}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      </GestureDetector>
    </Animated.View>
  );
}
