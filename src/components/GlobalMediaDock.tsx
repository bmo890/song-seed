import { Ionicons } from "@expo/vector-icons";
import { useSharedAudioRecorder } from "@siteed/audio-studio";
import { Pressable, Text, View } from "react-native";
import { MiniProgress } from "./MiniProgress";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRecordingDisplayElapsed } from "../hooks/useRecordingDisplayElapsed";
import { useFullPlayerContext } from "../hooks/FullPlayerProvider";
import { useStore } from "../state/useStore";
import { styles } from "../styles";
import { fmtDuration } from "../utils";

const DOCK_SPEED_OPTIONS = [0.5, 0.75, 1] as const;

type GlobalMediaDockProps = {
  activeRouteName: string;
  onOpenPlayer: () => void;
  onOpenRecording: () => void;
};

type PlaybackDockState = {
  kind: "player" | "inline";
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
  const inlineTarget = useStore((s) => s.inlineTarget);
  const inlinePositionMs = useStore((s) => s.inlinePositionMs);
  const inlineDurationMs = useStore((s) => s.inlineDurationMs);
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
  const fullPlayer = useFullPlayerContext();
  const inlinePlayerMounted = useStore((s) => s.inlinePlayerMounted);
  const inlinePlaybackSpeed = useStore((s) => s.inlinePlaybackSpeed);

  // Priority 1: full player is active and user has minimized it (navigated away
  // from the Player screen while audio continues playing in the background).
  // Priority 2: inline clip is playing but the ClipList is unmounted
  // (e.g. user switched from Takes to Lyrics/Notes tab).
  const activePlayback: PlaybackDockState | null = (() => {
    if (playerTarget && playerQueue.length > 0 && activeRouteName !== "Player") {
      const idea = allIdeas.find((item) => item.id === playerTarget.ideaId);
      const clip = idea?.clips.find((item) => item.id === playerTarget.clipId);
      if (idea && clip) {
        // The engine is persistent (FullPlayerProvider), so playerPositionMs
        // stays live even while the Player screen is unmounted.
        return {
          kind: "player",
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
    if (inlineTarget && !inlinePlayerMounted) {
      const idea = allIdeas.find((item) => item.id === inlineTarget.ideaId);
      const clip = idea?.clips.find((item) => item.id === inlineTarget.clipId);
      if (idea && clip) {
        return {
          kind: "inline",
          ideaId: idea.id,
          clipId: clip.id,
          title: clip.title,
          subtitle: idea.title,
          isPlaying: inlineIsPlaying,
          positionMs: inlinePositionMs,
          durationMs: inlineDurationMs || clip.durationMs || 0,
        } satisfies PlaybackDockState;
      }
    }
    return null;
  })();

  if (activeRouteName !== "Recording" && hasRecordingSession && recordingIdea) {
    const statusLabel = recorder.isPaused ? "Paused" : "Recording";
    return (
      <View style={[styles.miniMediaDockWrap, { bottom: Math.max(insets.bottom, 14) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.miniMediaDockCard,
            styles.miniMediaDockCardRecording,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onOpenRecording}
        >
          <View style={styles.miniMediaDockTopRow}>
            <View style={styles.miniMediaDockCopy}>
              <View style={styles.miniMediaDockBadgeRow}>
                <View
                  style={[
                    styles.miniMediaDockStatusDot,
                    recorder.isPaused
                      ? styles.miniMediaDockStatusDotPaused
                      : styles.miniMediaDockStatusDotRecording,
                  ]}
                />
                <Text style={styles.miniMediaDockBadgeTextRecording}>{statusLabel}</Text>
              </View>
              <Text style={styles.miniMediaDockTitle} numberOfLines={1}>
                {recordingIdea.title || "Recording"}
              </Text>
              <Text style={styles.miniMediaDockSubtitle} numberOfLines={1}>
                {recorder.isPaused ? "Recording is paused" : "Recording continues in the background"}
              </Text>
            </View>

            <View style={styles.miniMediaDockActionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.miniMediaDockActionBtn,
                  styles.miniMediaDockActionBtnRecording,
                  pressed ? styles.pressDownStrong : null,
                ]}
                onPress={(evt) => {
                  evt.stopPropagation();
                  if (recorder.isPaused) {
                    void recorder.resumeRecording();
                    return;
                  }
                  void recorder.pauseRecording();
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
                  styles.miniMediaDockActionBtn,
                  styles.miniMediaDockActionBtnRecordingPrimary,
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

          <View style={styles.miniMediaDockRecordingMetaRow}>
            <Text style={styles.miniMediaDockRecordingTime}>{fmtDuration(recordingElapsedMs)}</Text>
            <Text style={styles.miniMediaDockHintText}>Tap to reopen controls</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  if (!activePlayback) return null;

  return (
    <View style={[styles.miniMediaDockWrap, { bottom: Math.max(insets.bottom, 14) }]}>
      <Pressable
        style={({ pressed }) => [
          styles.miniMediaDockCard,
          pressed ? styles.pressDown : null,
        ]}
        onPress={onOpenPlayer}
      >
        <View style={styles.miniMediaDockTopRow}>
          <View style={styles.miniMediaDockCopy}>
            <View style={styles.miniMediaDockBadgeRow}>
              <View
                style={[
                  styles.miniMediaDockStatusDot,
                  activePlayback.isPlaying
                    ? styles.miniMediaDockStatusDotPlaying
                    : styles.miniMediaDockStatusDotPaused,
                ]}
              />
              <Text style={styles.miniMediaDockBadgeText}>
                {activePlayback.isPlaying ? "Playing" : "Paused"}
              </Text>
            </View>
            <Text style={styles.miniMediaDockTitle} numberOfLines={1}>
              {activePlayback.title}
            </Text>
            <Text style={styles.miniMediaDockSubtitle} numberOfLines={1}>
              {activePlayback.subtitle}
            </Text>
          </View>

          <View style={styles.miniMediaDockActionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockActionBtn,
                styles.miniMediaDockActionBtnPrimary,
                pressed ? styles.pressDownStrong : null,
              ]}
              onPress={(evt) => {
                evt.stopPropagation();
                if (activePlayback.kind === "player") {
                  if (activePlayback.isPlaying) {
                    void fullPlayer.pausePlayer();
                  } else {
                    void fullPlayer.playPlayer();
                  }
                  return;
                }
                useStore.getState().requestInlineToggle();
              }}
              accessibilityRole="button"
              accessibilityLabel={activePlayback.isPlaying ? "Pause playback" : "Play playback"}
            >
              <Ionicons
                name={activePlayback.isPlaying ? "pause" : "play"}
                size={18}
                color="#ffffff"
              />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockActionBtn,
                pressed ? styles.pressDownStrong : null,
              ]}
              onPress={(evt) => {
                evt.stopPropagation();
                if (activePlayback.kind === "player") {
                  void fullPlayer.closePlayer();
                  useStore.getState().clearPlayerQueue();
                  return;
                }
                useStore.getState().requestInlineStop();
              }}
              accessibilityRole="button"
              accessibilityLabel="Stop playback"
            >
              <Ionicons name="stop-circle-outline" size={16} color="#475569" />
            </Pressable>
          </View>
        </View>

        <View style={styles.miniMediaDockScrubWrap}>
          <MiniProgress
            hideTimes
            currentMs={activePlayback.positionMs}
            durationMs={activePlayback.durationMs}
            onSeek={(ms) => {
              if (activePlayback.kind === "player") {
                void fullPlayer.seekTo(ms);
                return;
              }
              useStore.getState().requestInlineSeek(ms);
            }}
          />
        </View>
        <View style={styles.miniMediaDockTimesRow}>
          <Text style={styles.miniMediaDockTime}>{fmtDuration(activePlayback.positionMs)}</Text>
          {activePlayback.kind === "inline" ? (
            <Pressable
              style={({ pressed }) => [
                styles.miniMediaDockSpeedChip,
                inlinePlaybackSpeed !== 1 ? styles.miniMediaDockSpeedChipActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                const currentIdx = DOCK_SPEED_OPTIONS.indexOf(inlinePlaybackSpeed as any);
                const nextIdx = (currentIdx + 1) % DOCK_SPEED_OPTIONS.length;
                useStore.getState().setInlinePlaybackSpeed(DOCK_SPEED_OPTIONS[nextIdx]);
              }}
              hitSlop={4}
            >
              <Text style={[
                styles.miniMediaDockSpeedChipText,
                inlinePlaybackSpeed !== 1 ? styles.miniMediaDockSpeedChipTextActive : null,
              ]}>
                {inlinePlaybackSpeed}x
              </Text>
            </Pressable>
          ) : null}
          <Text style={styles.miniMediaDockTime}>{fmtDuration(activePlayback.durationMs)}</Text>
        </View>
      </Pressable>
    </View>
  );
}
