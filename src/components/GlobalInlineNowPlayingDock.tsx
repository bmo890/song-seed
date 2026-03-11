import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../styles";
import { useStore } from "../state/useStore";
import { fmtDuration } from "../utils";

type GlobalInlineNowPlayingDockProps = {
  activeRouteName: string;
  onOpenPlayer: () => void;
};

export function GlobalInlineNowPlayingDock({
  activeRouteName,
  onOpenPlayer,
}: GlobalInlineNowPlayingDockProps) {
  const insets = useSafeAreaInsets();
  const workspaces = useStore((s) => s.workspaces);
  const inlineTarget = useStore((s) => s.inlineTarget);
  const inlinePositionMs = useStore((s) => s.inlinePositionMs);
  const inlineDurationMs = useStore((s) => s.inlineDurationMs);
  const inlineIsPlaying = useStore((s) => s.inlineIsPlaying);

  if (!inlineTarget) return null;
  if (activeRouteName === "CollectionDetail") return null;

  const idea = workspaces
    .flatMap((workspace) => workspace.ideas)
    .find((item) => item.id === inlineTarget.ideaId);

  if (!idea) return null;

  const clip = idea.clips.find((item) => item.id === inlineTarget.clipId);
  if (!clip) return null;

  const durationMs = inlineDurationMs || clip.durationMs || 0;
  const progressPct =
    durationMs > 0
      ? Math.max(0, Math.min(100, (inlinePositionMs / durationMs) * 100))
      : 0;

  return (
    <View style={[styles.globalInlineDockWrap, { bottom: Math.max(insets.bottom, 14) }]}>
      <Pressable
        style={({ pressed }) => [styles.globalInlineDockCard, pressed ? styles.pressDown : null]}
        onPress={() => {
          useStore.getState().requestInlineStop();
          useStore
            .getState()
            .setPlayerQueue([{ ideaId: idea.id, clipId: clip.id }], 0, inlineIsPlaying);
          onOpenPlayer();
        }}
      >
        <View style={styles.globalInlineDockTopRow}>
          <View style={styles.globalInlineDockCopy}>
            <Text style={styles.globalInlineDockTitle} numberOfLines={1}>
              {idea.title}
            </Text>
            <Text style={styles.globalInlineDockSubtitle} numberOfLines={1}>
              {clip.title}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.globalInlineDockCloseBtn, pressed ? styles.pressDownStrong : null]}
            onPress={(evt) => {
              evt.stopPropagation();
              useStore.getState().requestInlineStop();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close mini player"
          >
            <Ionicons name="close" size={14} color="#475569" />
          </Pressable>
        </View>

        <View style={styles.globalInlineDockProgressTrack}>
          <View style={[styles.globalInlineDockProgressFill, { width: `${progressPct}%` }]} />
        </View>
        <View style={styles.globalInlineDockTimesRow}>
          <Text style={styles.globalInlineDockTime}>{fmtDuration(inlinePositionMs)}</Text>
          <Text style={styles.globalInlineDockTime}>{fmtDuration(durationMs)}</Text>
        </View>
      </Pressable>
    </View>
  );
}
