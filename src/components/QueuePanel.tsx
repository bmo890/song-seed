import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../design/tokens";
import { haptic } from "../design/haptics";
import { useStore } from "../state/useStore";
import { fmtDuration } from "../utils";
import { getClipPlaybackDurationMs } from "../clipPresentation";
import { NowPlayingIndicator } from "./common/NowPlayingIndicator";

/**
 * The playback queue as a panel that extends UP from the media dock (not a
 * modal sheet): it stays open while you skip around — the rehearsal flow — and
 * never blocks the transport controls beneath it. Tapping a row jumps playback
 * and keeps the panel open. Works identically for playlist and ad-hoc queues.
 */
export function QueuePanel({
  onEndSession,
  onOpenIdea,
  framed = true,
}: {
  onEndSession: () => void;
  /** Navigate to a song/clip's own page ("go to song") — the rehearsal jump from
   *  hearing a track to working on it. Provided by the host, which owns nav. */
  onOpenIdea: (ideaId: string) => void;
  /** framed = standalone panel chrome (dock). false = bare content for hosts
   *  that provide their own container (the full player's bottom sheet). */
  framed?: boolean;
}) {
  const playerQueue = useStore((s) => s.playerQueue);
  const playerQueueIndex = useStore((s) => s.playerQueueIndex);
  const playerIsPlaying = useStore((s) => s.playerIsPlaying);
  const workspaces = useStore((s) => s.workspaces);

  const rows = playerQueue.map((item, index) => {
    const workspace = workspaces.find((ws) => ws.ideas.some((candidate) => candidate.id === item.ideaId));
    const idea = workspace?.ideas.find((candidate) => candidate.id === item.ideaId);
    const clip = idea?.clips.find((candidate) => candidate.id === item.clipId);
    return {
      key: `${item.ideaId}:${item.clipId}:${index}`,
      index,
      ideaId: idea?.id ?? null,
      workspaceId: workspace?.id ?? null,
      title: clip?.title || idea?.title || "Unknown clip",
      subtitle: idea?.title ?? "",
      durationMs: clip ? getClipPlaybackDurationMs(clip) ?? null : null,
      isCurrent: index === playerQueueIndex,
    };
  });

  const jumpTo = (index: number) => {
    const state = useStore.getState();
    state.requestInlineStop();
    state.setPlayerQueue(state.playerQueue, index, true);
    haptic.tap();
  };

  const goToSong = (row: (typeof rows)[number]) => {
    if (!row.ideaId || !row.workspaceId) return;
    const state = useStore.getState();
    if (state.activeWorkspaceId !== row.workspaceId) {
      state.setActiveWorkspaceId(row.workspaceId);
    }
    state.setSelectedIdeaId(row.ideaId);
    haptic.tap();
    onOpenIdea(row.ideaId);
  };

  return (
    <View style={framed ? panelStyles.panel : null}>
      <View style={panelStyles.headerRow}>
        <Text style={panelStyles.title}>Queue</Text>
        <Text style={panelStyles.counter}>
          {Math.min(playerQueueIndex + 1, playerQueue.length)} of {playerQueue.length}
        </Text>
      </View>

      <ScrollView style={panelStyles.list} showsVerticalScrollIndicator={false}>
        {rows.map((row) => (
          <Pressable
            key={row.key}
            style={({ pressed }) => [
              panelStyles.row,
              row.isCurrent ? panelStyles.rowCurrent : null,
              pressed ? { opacity: 0.75 } : null,
            ]}
            onPress={() => jumpTo(row.index)}
            accessibilityRole="button"
            accessibilityLabel={`Play ${row.title}`}
          >
            <View style={panelStyles.rowNum}>
              {row.isCurrent ? (
                <NowPlayingIndicator playing={playerIsPlaying} color={colors.primary} />
              ) : (
                <Text style={panelStyles.rowNumText}>{row.index + 1}</Text>
              )}
            </View>
            <View style={panelStyles.rowCopy}>
              <Text
                style={[panelStyles.rowTitle, row.isCurrent ? panelStyles.rowTitleCurrent : null]}
                numberOfLines={1}
              >
                {row.title}
              </Text>
              {row.subtitle && row.subtitle !== row.title ? (
                <Text style={panelStyles.rowSubtitle} numberOfLines={1}>
                  {row.subtitle}
                </Text>
              ) : null}
            </View>
            {row.durationMs != null ? (
              <Text style={panelStyles.rowDuration}>{fmtDuration(row.durationMs)}</Text>
            ) : null}
            {row.ideaId ? (
              <Pressable
                style={({ pressed }) => [panelStyles.goToBtn, pressed ? { opacity: 0.6 } : null]}
                onPress={(evt) => {
                  evt.stopPropagation();
                  goToSong(row);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${row.subtitle || row.title}`}
              >
                <Ionicons name="open-outline" size={15} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        style={({ pressed }) => [panelStyles.endBtn, pressed ? { opacity: 0.8 } : null]}
        onPress={onEndSession}
        accessibilityRole="button"
        accessibilityLabel="End listening session"
      >
        <Ionicons name="stop-circle-outline" size={15} color={colors.textStrong} />
        <Text style={panelStyles.endBtnLabel}>End session</Text>
      </Pressable>
    </View>
  );
}

const panelStyles = StyleSheet.create({
  // Sits directly above the dock surface inside the same bottom-anchored wrap,
  // so it visually extends the dock upward. Same paper, own top hairline.
  panel: {
    backgroundColor: "#FDFBF7",
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingBottom: spacing.xs,
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 17,
    color: colors.textPrimary,
  },
  counter: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  list: {
    maxHeight: 264,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
  },
  rowCurrent: {
    backgroundColor: colors.surfaceContainer,
  },
  rowNum: {
    width: 22,
    alignItems: "center",
  },
  rowNumText: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowTitle: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowTitleCurrent: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
  rowSubtitle: {
    ...textTokens.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  rowDuration: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  goToBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  endBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 6,
    marginBottom: 6,
    paddingVertical: 9,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
  },
  endBtnLabel: {
    ...textTokens.caption,
    color: colors.textStrong,
    fontFamily: "PlusJakartaSans_700Bold",
  },
});
