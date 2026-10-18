import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GestureDetector } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { useSongbookReaderModel } from "./useSongbookReaderModel";
import { ScreenHeader } from "../common/ScreenHeader";
import { SegmentedControl } from "../common/SegmentedControl";
import { NowPlayingIndicator } from "../common/NowPlayingIndicator";
import { Press } from "../common/Press";
import { ReadingChart, ReadingLyrics } from "../common/SongReading";
import { ReadingSheet, readingKeyLabel } from "../common/ReadingSheet";
import { SongPagerStrip, SongPosition, useSongSwipe } from "../common/SongPagerStrip";
import { colors, text as textTokens } from "../../design/tokens";
import { fmtDuration } from "../../utils";
import { getClipPlaybackDurationMs } from "../../domain/clipPresentation";
import { looksMachineNamed } from "../../domain/titleNaming";
import type { SongbookReaderView } from "../../domain/songbookGrouping";
import { UserText } from "../../i18n";

/** Full-screen book reading (stage pass, 2026-10-18): one song per page, its
 *  Lyrics or its Chart, the shared Aa sheet, and a strip at the foot that turns
 *  pages by song name, plays the song and keeps the click. A swipe turns the
 *  page too. Audio rides in the global dock underneath, and the strip sits
 *  above it, so playing never buries the page turn. */
export function SongbookReaderScreen() {
  const { t } = useTranslation();
  const reader = useSongbookReaderModel();
  const [sheetOpen, setSheetOpen] = useState(false);
  const swipe = useSongSwipe(reader.goPrevious, reader.goNext);

  const song = reader.song;
  if (!reader.songbook || !song) return null;

  const durationMs = song.playableClip ? getClipPlaybackDurationMs(song.playableClip) : null;
  const keyText = readingKeyLabel(t, reader.transpose, reader.capo);
  const titleIsMachine = looksMachineNamed(song.title);
  const clickOn = reader.metronome.isRunning || reader.metronome.isCountIn;
  const clickBpm = reader.tempo ?? reader.metronome.bpm;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.head}>
        <ScreenHeader
          title=""
          variant="place"
          leftIcon="back"
          rightElement={<SongPosition current={reader.index + 1} total={reader.count} />}
        />
        <UserText value={reader.songbook.title} style={styles.eyebrow} numberOfLines={1}>
          {reader.songbook.title}
        </UserText>
        <UserText
          value={song.title}
          style={[styles.title, titleIsMachine ? styles.titleMachine : null]}
          numberOfLines={2}
          accessibilityRole="header"
        >
          {song.title}
        </UserText>

        <View style={styles.toolRow}>
          <View style={styles.tabs}>
            {reader.views.length > 1 ? (
              <SegmentedControl<SongbookReaderView>
                options={reader.views.map((view) => ({
                  key: view,
                  label: view === "lyrics" ? t("reading.lyrics") : t("reading.chart"),
                }))}
                value={reader.view ?? undefined}
                onChange={reader.setView}
              />
            ) : (
              <Text style={styles.singleView}>
                {reader.view === "chart" ? t("reading.chart") : t("reading.lyrics")}
              </Text>
            )}
          </View>
          <Press
            feel="glyph"
            // haptics.ts: tap → a control acted (a sheet opens).
            haptic="tap"
            style={styles.aaKey}
            onPress={() => setSheetOpen(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("reading.sheetA11y")}
          >
            <Text style={styles.aaGlyph}>{t("reading.aa")}</Text>
            {keyText ? <Text style={styles.aaKeyText}>{keyText}</Text> : null}
          </Press>
        </View>
      </View>

      <GestureDetector gesture={swipe}>
        <ScrollView
          style={styles.page}
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          {reader.view === "chart" && reader.chordSheet ? (
            <ReadingChart sheet={reader.chordSheet} />
          ) : (
            <ReadingLyrics lines={reader.lyricLines} showChords={reader.showChords} zoom={reader.zoom} />
          )}
        </ScrollView>
      </GestureDetector>

      <SongPagerStrip
        previousTitle={reader.previousTitle}
        nextTitle={reader.nextTitle}
        onPrevious={reader.goPrevious}
        onNext={reader.goNext}
      >
        {song.playableClip ? (
          <Press
            feel="glyph"
            // haptics.ts: tap → a control acted.
            haptic="tap"
            style={styles.stripKey}
            onPress={reader.toggleSongAudio}
            accessibilityRole="button"
            accessibilityLabel={t(
              reader.nowPlayingThisSong && reader.isPlayerPlaying ? "reading.pauseSong" : "reading.playSong",
              { title: song.title }
            )}
          >
            {reader.nowPlayingThisSong ? (
              <NowPlayingIndicator playing={reader.isPlayerPlaying} color={colors.primary} size={12} />
            ) : (
              <Ionicons name="play" size={13} color={colors.textStrong} />
            )}
            {durationMs != null ? (
              <Text style={[styles.stripKeyText, reader.nowPlayingThisSong ? styles.stripKeyTextActive : null]}>
                {fmtDuration(durationMs)}
              </Text>
            ) : null}
          </Press>
        ) : null}
        <Press
          feel="glyph"
          // haptics.ts: light → a toggle flipped.
          haptic="light"
          style={styles.stripKey}
          onPress={reader.metronome.toggleRunning}
          accessibilityRole="switch"
          accessibilityState={{ checked: clickOn }}
          accessibilityLabel={clickOn ? t("reading.stopClick") : t("reading.startClick", { bpm: clickBpm })}
        >
          <Ionicons name="pulse-outline" size={17} color={clickOn ? colors.primaryDeep : colors.textStrong} />
          <Text style={[styles.stripKeyText, clickOn ? styles.stripKeyTextActive : null]}>{clickBpm}</Text>
        </Press>
      </SongPagerStrip>

      <ReadingSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        ideaId={song.ideaId}
        hasChords={reader.hasLyricChords || song.hasChordChart}
        hasLyricChords={reader.hasLyricChords && reader.view === "lyrics"}
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
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 10,
  },
  tabs: {
    flex: 1,
    minWidth: 0,
  },
  singleView: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
  },
  aaKey: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
  },
  aaGlyph: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 18,
    letterSpacing: -0.5,
    color: colors.textStrong,
  },
  aaKeyText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.primaryDeep,
    fontVariant: ["tabular-nums"],
  },
  page: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
  },
  stripKey: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  stripKeyText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  stripKeyTextActive: {
    color: colors.primaryDeep,
  },
});
