import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSongbookReaderModel } from "./useSongbookReaderModel";
import { ChordChart } from "../LyricsVersionScreen/components/chords/ChordChart";
import { ChordSheetSection } from "../ChordSheetScreen/ChordSheetSection";
import { TransposeChip } from "../common/TransposeChip";
import { NowPlayingIndicator } from "../common/NowPlayingIndicator";
import { useMetronome } from "../../hooks/useMetronome";
import { transposeChordSheet, transposeLyricsLines } from "../../domain/transpose";
import { colors, radii, text as textTokens } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { fmtDuration } from "../../utils";
import { getClipPlaybackDurationMs } from "../../domain/clipPresentation";
import type { SongbookReaderView } from "../../domain/songbookGrouping";
import { useTranslation } from "react-i18next";
import { UserText } from "../../i18n";

const noop = () => {};

/** Full-screen book reading: one song per page, switchable chart views, the
 *  transpose stepper, and a pager strip that turns pages by song name. Audio
 *  rides in the global dock underneath — this screen deliberately does NOT
 *  obscure the player. */
export function SongbookReaderScreen() {
  const { t } = useTranslation();
  const viewLabel = (view: SongbookReaderView) => t(view === "lyrics" ? "screens.lyrics" : view === "chart" ? "screens.chart" : "library.grid");
  const reader = useSongbookReaderModel();
  const metronome = useMetronome();

  const song = reader.song;
  const idea = song?.idea ?? null;

  // Resolve the lyric version this book references for the current song.
  const lyricVersion = useMemo(() => {
    if (!song || !idea) return null;
    const chart = song.charts.find((candidate) => candidate.kind === "lyricChart" && candidate.available);
    if (!chart) return null;
    return idea.lyrics?.versions.find((version) => version.id === chart.versionId) ?? null;
  }, [idea, song]);

  const transposedLines = useMemo(
    () => (lyricVersion ? transposeLyricsLines(lyricVersion.document.lines, reader.transpose) : []),
    [lyricVersion, reader.transpose]
  );

  const transposedSheet = useMemo(
    () =>
      idea?.chordSheet && song?.hasChordChart
        ? transposeChordSheet(idea.chordSheet, reader.transpose)
        : null,
    [idea?.chordSheet, reader.transpose, song?.hasChordChart]
  );

  if (!reader.songbook || !song) return null;

  const durationMs = song.playableClip ? getClipPlaybackDurationMs(song.playableClip) : null;

  return (
    <SafeAreaView style={readerStyles.screen}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={readerStyles.top}>
        <Pressable
          onPress={reader.close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("library.closeBook")}
          style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
        >
          <Ionicons name="close" size={20} color={colors.textStrong} />
        </Pressable>
        <View style={readerStyles.titleWrap}>
          <UserText style={readerStyles.bookName} numberOfLines={1}>
            {reader.songbook.title}
          </UserText>
          <UserText style={readerStyles.songTitle} numberOfLines={1}>
            {song.title}
          </UserText>
        </View>
        <Text style={readerStyles.position}>
          {reader.index + 1} / {reader.count}
        </Text>
      </View>

      {/* ── Tools: view switcher · transpose · zoom ────────────────────── */}
      <View style={readerStyles.toolRow}>
        {reader.views.length > 1 ? (
          <View style={readerStyles.seg}>
            {reader.views.map((candidate) => (
              <Pressable
                key={candidate}
                style={[readerStyles.segItem, reader.view === candidate ? readerStyles.segItemOn : null]}
                onPress={() => reader.setView(candidate)}
                accessibilityRole="button"
                accessibilityLabel={t(candidate === "lyrics" ? "library.lyricsView" : candidate === "chart" ? "library.chartView" : "library.gridView")}
              >
                <UserText
                  style={[
                    readerStyles.segLabel,
                    reader.view === candidate ? readerStyles.segLabelOn : null,
                  ]}
                >
                  {viewLabel(candidate)}
                </UserText>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {reader.view !== "lyrics" ? (
          <TransposeChip
            offset={reader.transpose}
            onNudge={reader.nudgeTranspose}
            onReset={reader.resetTranspose}
          />
        ) : null}

        <Pressable
          onPress={reader.cycleZoom}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("library.cycleTextSize")}
          style={({ pressed }) => [readerStyles.zoomBtn, pressed ? { opacity: 0.6 } : null]}
        >
          <Ionicons name="search-outline" size={15} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* ── The page ───────────────────────────────────────────────────── */}
      {reader.view === "chart" ? (
        <View style={readerStyles.chartFill}>
          <ChordChart lines={transposedLines} editable={false} zoom={reader.zoom} />
        </View>
      ) : (
        <ScrollView
          style={readerStyles.chartFill}
          contentContainerStyle={readerStyles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          {reader.view === "lyrics" ? (
            <View style={readerStyles.paper}>
              {(lyricVersion?.document.lines ?? []).map((line) => (
                <Text
                  key={line.id}
                  style={[readerStyles.lyricLine, { fontSize: 15 * reader.zoom, lineHeight: 24 * reader.zoom }]}
                >
                  {line.text || " "}
                </Text>
              ))}
            </View>
          ) : null}

          {reader.view === "grid" && transposedSheet ? (
            <View style={readerStyles.gridWrap}>
              {transposedSheet.sections.map((section) => (
                <ChordSheetSection
                  key={section.id}
                  section={section}
                  editable={false}
                  selectionActive={false}
                  selectedMeasureIds={[]}
                  onTapMeasure={noop}
                  onLongPressMeasure={noop}
                  onAddMeasure={noop}
                  onNotes={noop}
                  onOpenMenu={noop}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* ── Pager strip: prev · audio + metronome · next ───────────────── */}
      <View style={readerStyles.footer}>
        <Pressable
          style={({ pressed }) => [
            readerStyles.pagerSide,
            !reader.previousTitle ? readerStyles.pagerSideDisabled : null,
            pressed && reader.previousTitle ? { opacity: 0.6 } : null,
          ]}
          onPress={() => {
            haptic.light();
            reader.goPrevious();
          }}
          disabled={!reader.previousTitle}
          accessibilityRole="button"
          accessibilityLabel={reader.previousTitle ? t("library.previousSong", { title: reader.previousTitle }) : t("library.firstSong")}
        >
          <Ionicons name="chevron-back" size={13} color={colors.textSecondary} />
          <UserText style={readerStyles.pagerSideText} numberOfLines={1}>
            {reader.previousTitle ?? "—"}
          </UserText>
        </Pressable>

        <View style={readerStyles.pagerMid}>
          {song.playableClip ? (
            <Pressable
              style={({ pressed }) => [readerStyles.toolChip, pressed ? { opacity: 0.7 } : null]}
              onPress={() => {
                haptic.tap();
                reader.toggleSongAudio();
              }}
              accessibilityRole="button"
              accessibilityLabel={t(reader.nowPlayingThisSong ? "library.pauseReference" : "library.playReference")}
            >
              {reader.nowPlayingThisSong ? (
                <NowPlayingIndicator playing={reader.isPlayerPlaying} color={colors.primary} size={10} />
              ) : (
                <Ionicons name="play" size={10} color={colors.textStrong} />
              )}
              <Text style={readerStyles.toolChipText}>
                {durationMs != null ? fmtDuration(durationMs) : t("common.play")}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              readerStyles.toolChip,
              metronome.isRunning ? readerStyles.toolChipActive : null,
              pressed ? { opacity: 0.7 } : null,
            ]}
            onPress={() => {
              haptic.light();
              metronome.toggleRunning();
            }}
            accessibilityRole="button"
            accessibilityLabel={t(metronome.isRunning ? "metronome.stopA11y" : "metronome.startA11y")}
          >
            <Ionicons
              name="pulse-outline"
              size={12}
              color={metronome.isRunning ? colors.onPrimary : colors.textStrong}
            />
            <Text
              style={[readerStyles.toolChipText, metronome.isRunning ? readerStyles.toolChipTextActive : null]}
            >
              {metronome.bpm}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            readerStyles.pagerSide,
            readerStyles.pagerSideRight,
            !reader.nextTitle ? readerStyles.pagerSideDisabled : null,
            pressed && reader.nextTitle ? { opacity: 0.6 } : null,
          ]}
          onPress={() => {
            haptic.light();
            reader.goNext();
          }}
          disabled={!reader.nextTitle}
          accessibilityRole="button"
          accessibilityLabel={reader.nextTitle ? t("library.nextSong", { title: reader.nextTitle }) : t("library.lastSong")}
        >
          <UserText style={readerStyles.pagerSideText} numberOfLines={1}>
            {reader.nextTitle ?? "—"}
          </UserText>
          <Ionicons name="chevron-forward" size={13} color={colors.textSecondary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const readerStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fbf9f5",
    paddingHorizontal: 16,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 8,
    paddingBottom: 2,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 1,
  },
  bookName: {
    ...textTokens.annotation,
    color: colors.textMuted,
  },
  songTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
  },
  position: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  seg: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.round,
    padding: 3,
    gap: 2,
  },
  segItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: radii.round,
  },
  segItemOn: {
    backgroundColor: colors.surface,
  },
  segLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.textSecondary,
  },
  segLabelOn: {
    color: colors.textPrimary,
  },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  chartFill: {
    flex: 1,
  },
  pageContent: {
    paddingBottom: 16,
  },
  paper: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  lyricLine: {
    fontFamily: "PlayfairDisplay_400Regular",
    color: colors.textPrimary,
  },
  gridWrap: {
    gap: 4,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.xl,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 10,
  },
  pagerSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 104,
  },
  pagerSideRight: {
    justifyContent: "flex-end",
  },
  pagerSideDisabled: {
    opacity: 0.35,
  },
  pagerSideText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  pagerMid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.round,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  toolChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toolChipText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  toolChipTextActive: {
    color: colors.onPrimary,
  },
});
