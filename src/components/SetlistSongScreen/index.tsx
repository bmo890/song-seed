import React, { useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GestureDetector } from "react-native-gesture-handler";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useStore } from "../../state/useStore";
import { ScreenHeader } from "../common/ScreenHeader";
import { NowPlayingIndicator } from "../common/NowPlayingIndicator";
import { InkKey } from "../common/InkKey";
import { Press } from "../common/Press";
import { SongPagerStrip, SongPosition, useSongSwipe } from "../common/SongPagerStrip";
import {
  buildSetlistQueue,
  resolveSetlistEntries,
  type ResolvedSetlistEntry,
} from "../../domain/setlistPlayback";
import { looksMachineNamed } from "../../domain/titleNaming";
import { useKeepAwakeWhileFocused } from "../../hooks/useKeepAwakeWhileFocused";
import { colors, text as textTokens } from "../../design/tokens";
import { fmtDuration } from "../../utils";
import { UserText } from "../../i18n";

/**
 * A setlist entry's SONG FOLDER — the packaged, stripped-down song page: the
 * chosen takes/parts (sections and pins intact), the lyrics and the chart to
 * read, and the song notes. Playing expands into the full player and its
 * practice tools; a bandmate who received this set sees exactly this page.
 *
 * Stage pass (2026-10-18): the foot strip turns to the previous or next song in
 * the set (a swipe does too) in place, without stacking pages; the screen stays
 * lit; parts are rows on paper.
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

  useKeepAwakeWhileFocused("setlist-song");

  const previous = entryIndex > 0 ? entries[entryIndex - 1]! : null;
  const next = entryIndex >= 0 && entryIndex < entries.length - 1 ? entries[entryIndex + 1]! : null;
  // Turning the page swaps this page's entry in place: back still lands on the set.
  const goPrevious = useCallback(() => {
    if (previous) navigation.setParams({ entryId: previous.entryId });
  }, [navigation, previous]);
  const goNext = useCallback(() => {
    if (next) navigation.setParams({ entryId: next.entryId });
  }, [navigation, next]);
  const swipe = useSongSwipe(goPrevious, goNext);

  if (!setlist || !entry) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.head}>
          <ScreenHeader title="" variant="place" leftIcon="back" />
        </View>
        <View style={styles.missingWrap}>
          <Ionicons name="albums-outline" size={26} color={colors.textMuted} />
          <Text style={styles.missingText}>{t("setlistSong.missing")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const idea = entry.idea;
  const packedLyricVersionId = entry.lyricVersionIds[0] ?? null;
  const hasLyrics = !!packedLyricVersionId;
  const hasChart = entry.hasChordChart;
  const showNotes = entry.includeSongNotes && entry.songNotes.trim().length > 0;
  const titleIsMachine = looksMachineNamed(entry.title);

  const metaParts = [
    t("setlistSong.partCount", { count: entry.parts.length }),
    ...(hasLyrics ? [t("setlistSong.lyrics")] : []),
    ...(hasChart ? [t("setlistSong.chart")] : []),
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
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.head}>
        <ScreenHeader
          title=""
          variant="place"
          leftIcon="back"
          rightElement={<SongPosition current={entryIndex + 1} total={entries.length} />}
        />
      </View>

      <GestureDetector gesture={swipe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <UserText value={setlist.title} style={styles.eyebrow} numberOfLines={1}>
            {setlist.title}
          </UserText>
          <UserText
            value={entry.title}
            style={[styles.title, titleIsMachine ? styles.titleMachine : null]}
            numberOfLines={2}
            accessibilityRole="header"
          >
            {entry.title}
          </UserText>
          <Text style={styles.meta}>{metaParts.join(" · ")}</Text>

          <View style={styles.actionRow}>
            <Press
              feel="surface"
              // haptics.ts: tap → a control acted.
              haptic="tap"
              style={[styles.playBtn, !entry.available ? styles.playBtnDisabled : null]}
              onPress={() => playEntry()}
              disabled={!entry.available}
              accessibilityRole="button"
              accessibilityLabel={t("setlistSong.practice", { title: entry.title })}
            >
              <Ionicons name="play" size={22} color={colors.onPrimary} style={styles.playGlyph} />
            </Press>

            {hasLyrics && idea ? (
              <InkKey
                glyph={<Ionicons name="document-text-outline" size={17} color={colors.textStrong} />}
                label={t("setlistSong.lyrics")}
                // haptics.ts: navigation is silent.
                haptic="navigate"
                accessibilityLabel={t("setlistSong.openLyrics")}
                onPress={() =>
                  navigation.navigate("LyricsVersion", {
                    ideaId: idea.id,
                    versionId: packedLyricVersionId ?? undefined,
                  })
                }
              />
            ) : null}

            {hasChart && idea ? (
              <InkKey
                glyph={<Ionicons name="grid-outline" size={16} color={colors.textStrong} />}
                label={t("setlistSong.chart")}
                // haptics.ts: navigation is silent.
                haptic="navigate"
                accessibilityLabel={t("setlistSong.openChart")}
                onPress={() => navigation.navigate("ChordSheet", { ideaId: idea.id })}
              />
            ) : null}
          </View>

          <Text style={styles.sectionLabel}>{t("setlistSong.parts")}</Text>
          <View style={styles.list}>
            {entry.parts.map((part) => {
              const isNowPlaying = playerTarget?.clipId === part.clipId && playerTarget?.ideaId === idea?.id;
              const partMeta = [
                part.sectionCount > 0 ? t("setlistSong.sectionCount", { count: part.sectionCount }) : null,
                part.pinCount > 0 ? t("setlistSong.pinCount", { count: part.pinCount }) : null,
              ]
                .filter((chip): chip is string => !!chip)
                .join(" · ");
              const partIsMachine = looksMachineNamed(part.title);

              return (
                <Press
                  key={part.clipId}
                  feel="surface"
                  // haptics.ts: tap → a control acted.
                  haptic="tap"
                  style={[styles.partRow, !part.available ? styles.partRowDisabled : null]}
                  onPress={() => playEntry(part.clipId)}
                  disabled={!part.available}
                  accessibilityRole="button"
                  accessibilityLabel={t("setlistSong.practice", { title: part.title })}
                >
                  <View style={styles.partLead}>
                    {isNowPlaying ? (
                      <NowPlayingIndicator playing={isPlayerPlaying} color={colors.primary} size={12} />
                    ) : (
                      <Ionicons name="play" size={13} color={colors.textStrong} />
                    )}
                  </View>
                  <View style={styles.partMain}>
                    <UserText
                      value={part.title}
                      style={[
                        styles.partTitle,
                        partIsMachine ? styles.partTitleMachine : null,
                        isNowPlaying ? styles.partTitleActive : null,
                      ]}
                      numberOfLines={1}
                    >
                      {part.title}
                    </UserText>
                    {partMeta ? <Text style={styles.partMeta}>{partMeta}</Text> : null}
                  </View>
                  <Text style={styles.partDuration}>
                    {part.durationMs != null ? fmtDuration(part.durationMs) : "--:--"}
                  </Text>
                </Press>
              );
            })}
          </View>

          {showNotes ? (
            <>
              <Text style={styles.sectionLabel}>{t("setlistSong.notesTitle")}</Text>
              <UserText align="content" value={entry.songNotes} style={styles.notesText}>
                {entry.songNotes}
              </UserText>
            </>
          ) : null}
        </ScrollView>
      </GestureDetector>

      <SongPagerStrip
        previousTitle={previous?.title ?? null}
        nextTitle={next?.title ?? null}
        onPrevious={goPrevious}
        onNext={goNext}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  head: {
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  eyebrow: {
    ...textTokens.annotation,
    color: colors.textMuted,
  },
  title: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
    marginTop: 2,
  },
  titleMachine: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 24,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  meta: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginTop: 16,
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnDisabled: {
    opacity: 0.4,
  },
  playGlyph: {
    marginLeft: 3,
  },
  sectionLabel: {
    ...textTokens.annotation,
    color: colors.textSecondary,
    marginTop: 26,
    marginBottom: 6,
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  partRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 60,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  partRowDisabled: {
    opacity: 0.45,
  },
  partLead: {
    width: 16,
    alignItems: "center",
  },
  partMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  partTitle: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 16,
    color: colors.textPrimary,
  },
  partTitleMachine: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  partTitleActive: {
    color: colors.primaryDeep,
  },
  partMeta: {
    ...textTokens.caption,
    color: colors.textSecondary,
  },
  partDuration: {
    ...textTokens.caption,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  notesText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    lineHeight: 23,
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
