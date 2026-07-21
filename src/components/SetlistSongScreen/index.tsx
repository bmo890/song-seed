import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../state/useStore";
import { ScreenHeader } from "../common/ScreenHeader";
import { NowPlayingIndicator } from "../common/NowPlayingIndicator";
import {
  buildSetlistQueue,
  resolveSetlistEntries,
  type ResolvedSetlistEntry,
} from "../../domain/setlistPlayback";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { fmtDuration } from "../../utils";
import { useTranslation } from "react-i18next";
import { UserText } from "../../i18n";

/**
 * A setlist entry's SONG FOLDER — the packaged, stripped-down song page: the
 * chosen takes/parts (sections and pins intact), one-tap chart buttons, and the
 * song notes. Playing expands into the full player and its practice tools; a
 * bandmate who received this set sees exactly this page.
 */
export function SetlistSongScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const setlistId = route.params?.setlistId as string | undefined;
  const entryId = route.params?.entryId as string | undefined;

  const workspaces = useStore((s) => s.workspaces);
  const setlists = useStore((s) => s.setlists);
  const playerTarget = useStore((s) => s.playerTarget);
  const isPlayerPlaying = useStore((s) => s.playerIsPlaying);

  const setlist = setlists.find((candidate) => candidate.id === setlistId) ?? null;

  const { entry, entryIndex, entries } = useMemo((): {
    entry: ResolvedSetlistEntry | null;
    entryIndex: number;
    entries: ResolvedSetlistEntry[];
  } => {
    if (!setlist) return { entry: null, entryIndex: -1, entries: [] };
    const resolved = resolveSetlistEntries(workspaces, setlist);
    const index = resolved.findIndex((candidate) => candidate.entryId === entryId);
    return { entry: index >= 0 ? resolved[index]! : null, entryIndex: index, entries: resolved };
  }, [entryId, setlist, workspaces]);

  if (!setlist || !entry) {
    return (
      <SafeAreaView style={folderStyles.screen}>
        <ScreenHeader title={t("setlistSong.setlist")} leftIcon="back" />
        <View style={folderStyles.missingWrap}>
          <Ionicons name="albums-outline" size={26} color={colors.textMuted} />
          <Text style={folderStyles.missingText}>{t("setlistSong.missing")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const idea = entry.idea;
  const packedLyricVersionId = entry.lyricVersionIds[0] ?? null;
  const hasLyrics = !!packedLyricVersionId;
  const hasChords = entry.hasChordChart;
  const showNotes = entry.includeSongNotes && entry.songNotes.trim().length > 0;

  const metaParts = [
    t("setlistSong.partCount", { count: entry.parts.length }),
    ...(hasLyrics ? [t("setlistSong.lyrics")] : []),
    ...(hasChords ? [t("setlistSong.chords")] : []),
    ...(showNotes ? [t("setlistSong.notes")] : []),
  ];

  // Playing from the folder queues THIS entry's parts and expands the full
  // player — every practice tool (loop, sections, pins, speed, pitch) at hand.
  const playEntry = (startClipId?: string) => {
    const { queue, startIndex } = buildSetlistQueue(entries, entry.entryId, startClipId);
    if (queue.length === 0) return;
    useStore.getState().setPlayerQueueForScreen(queue, startIndex, true);
  };

  return (
    <SafeAreaView style={folderStyles.screen}>
      <ScreenHeader title={setlist.title} leftIcon="back" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={folderStyles.scrollContent}
      >
        <View style={folderStyles.header}>
          <Text style={folderStyles.eyebrow}>
            {t("setlistSong.songPosition", { current: entryIndex + 1, total: entries.length })}
          </Text>
          <UserText style={folderStyles.title} numberOfLines={2}>
            {entry.title}
          </UserText>
          <Text style={folderStyles.meta}>{metaParts.join(" · ")}</Text>

          <View style={folderStyles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                folderStyles.playBtn,
                !entry.available ? folderStyles.playBtnDisabled : null,
                pressed ? { opacity: 0.85 } : null,
              ]}
              onPress={() => {
                haptic.tap();
                playEntry();
              }}
              disabled={!entry.available}
              accessibilityRole="button"
              accessibilityLabel={t("setlistSong.practice", { title: entry.title })}
            >
              <Ionicons name="play" size={22} color={colors.onPrimary} style={{ marginLeft: 3 }} />
            </Pressable>

            {hasLyrics && idea ? (
              <Pressable
                style={({ pressed }) => [folderStyles.chartBtn, pressed ? { opacity: 0.7 } : null]}
                onPress={() =>
                  navigation.navigate("LyricsVersion", {
                    ideaId: idea.id,
                    versionId: packedLyricVersionId ?? undefined,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={t("setlistSong.openLyrics")}
              >
                <Ionicons name="document-text-outline" size={14} color={colors.textStrong} />
                <Text style={folderStyles.chartBtnLabel}>{t("screens.lyrics")}</Text>
              </Pressable>
            ) : null}

            {hasChords && idea ? (
              <Pressable
                style={({ pressed }) => [folderStyles.chartBtn, pressed ? { opacity: 0.7 } : null]}
                onPress={() => navigation.navigate("ChordSheet", { ideaId: idea.id })}
                accessibilityRole="button"
                accessibilityLabel={t("setlistSong.openChords")}
              >
                <Ionicons name="grid-outline" size={14} color={colors.textStrong} />
                <Text style={folderStyles.chartBtnLabel}>{t("common.chords")}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={folderStyles.sectionLabel}>{t("setlistSong.parts")}</Text>
        <View style={folderStyles.list}>
          {entry.parts.map((part) => {
            const isNowPlaying =
              playerTarget?.clipId === part.clipId && playerTarget?.ideaId === idea?.id;
            const chips = [
              part.sectionCount > 0
                ? t("setlistSong.sectionCount", { count: part.sectionCount })
                : null,
              part.pinCount > 0 ? t("setlistSong.pinCount", { count: part.pinCount }) : null,
            ].filter((chip): chip is string => !!chip);

            return (
              <Pressable
                key={part.clipId}
                style={({ pressed }) => [
                  folderStyles.partRow,
                  isNowPlaying ? folderStyles.partRowActive : null,
                  pressed && part.available ? { opacity: 0.8 } : null,
                ]}
                onPress={() => {
                  if (!part.available) return;
                  haptic.tap();
                  playEntry(part.clipId);
                }}
                disabled={!part.available}
                accessibilityRole="button"
                accessibilityLabel={t("setlistSong.practice", { title: part.title })}
              >
                <View style={folderStyles.partLead}>
                  {isNowPlaying ? (
                    <NowPlayingIndicator playing={isPlayerPlaying} color={colors.primary} size={12} />
                  ) : (
                    <Ionicons
                      name="play"
                      size={12}
                      color={part.available ? colors.textPrimary : colors.textMuted}
                      style={{ marginLeft: 1 }}
                    />
                  )}
                </View>
                <View style={folderStyles.partMain}>
                  <UserText
                    style={[folderStyles.partTitle, isNowPlaying ? folderStyles.partTitleActive : null]}
                    numberOfLines={1}
                  >
                    {part.title}
                  </UserText>
                  {chips.length > 0 ? (
                    <View style={folderStyles.partChipRow}>
                      {chips.map((chip) => (
                        <Text key={chip} style={folderStyles.partChip}>
                          {chip}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
                <Text style={folderStyles.partDuration}>
                  {part.durationMs != null ? fmtDuration(part.durationMs) : "--:--"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {showNotes ? (
          <>
            <Text style={folderStyles.sectionLabel}>{t("setlistSong.notesTitle")}</Text>
            <View style={folderStyles.notesCard}>
              <UserText style={folderStyles.notesText}>{entry.songNotes}</UserText>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const folderStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fbf9f5",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  header: {
    paddingTop: 6,
    paddingBottom: 16,
  },
  eyebrow: {
    ...textTokens.annotation,
    color: colors.primaryDeep,
    marginBottom: 4,
  },
  title: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  meta: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: 14,
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnDisabled: {
    opacity: 0.4,
  },
  chartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.round,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  chartBtnLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textStrong,
  },
  sectionLabel: {
    ...textTokens.annotation,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: 8,
  },
  list: {
    gap: 8,
  },
  partRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  partRowActive: {
    backgroundColor: "#FDF5F2",
    borderColor: "#EBD3CE",
  },
  partLead: {
    width: 30,
    height: 30,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  partMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  partTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  partTitleActive: {
    color: colors.primaryDeep,
  },
  partChipRow: {
    flexDirection: "row",
    gap: 5,
  },
  partChip: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 8.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.primaryDeep,
    backgroundColor: "#FDF5F2",
    borderWidth: 1,
    borderColor: "#EBD3CE",
    borderRadius: 4,
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  partDuration: {
    ...textTokens.caption,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  notesCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  notesText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.textStrong,
  },
  missingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  missingText: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
