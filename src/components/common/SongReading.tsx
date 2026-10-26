import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, spacing } from "../../design/tokens";
import type { ChordSheet, LyricsLine } from "../../types";
import { UserText, signedNumberText } from "../../i18n";
import { SerifChordLines } from "../LyricsVersionScreen/components/chords/SerifChordChart";
import {
  READING_LYRIC_LINE_HEIGHT,
  READING_LYRIC_SIZE,
} from "../LyricsVersionScreen/components/chords/chordChartStyle";
import { ChordSheetSection } from "../ChordSheetScreen/ChordSheetSection";
import { TransposeChip } from "./TransposeChip";
import { Switch } from "./Switch";
import { formatTransposeOffset, playbackChordShift } from "../../domain/transpose";
import { useChartPrefsStore } from "../../state/useChartPrefsStore";

/**
 * How a song is READ, wherever it is read (2026-10-18, founder: "make sure
 * it's aligned"): the full player, the songbook reader and a setlist page all
 * draw the same two things through these, so they cannot drift apart.
 *
 * - Lyrics: the words, on the one reading scale, with the chords above them
 *   when the version has chords and the reader has not hidden them.
 * - Chart: the bar grid, its notes sections as quiet italic lines.
 *
 * Neither owns a scroll; drop them inside the surface's own scroller. Any key
 * or capo shift is applied by the caller before the lines come in.
 */

const noop = () => {};
const NO_SELECTION: string[] = [];

export function ReadingLyrics({
  lines,
  showChords,
  zoom,
}: {
  lines: LyricsLine[];
  showChords: boolean;
  zoom: number;
}) {
  if (showChords && lines.some((line) => line.chords.length > 0)) {
    return <SerifChordLines lines={lines} zoom={zoom} />;
  }
  return (
    <View>
      {lines.map((line) =>
        line.text.trim() ? (
          <UserText
            key={line.id}
            align="content"
            value={line.text}
            style={[
              styles.lyric,
              { fontSize: READING_LYRIC_SIZE * zoom, lineHeight: READING_LYRIC_LINE_HEIGHT * zoom },
            ]}
          >
            {line.text}
          </UserText>
        ) : (
          <View key={line.id} style={{ height: 18 * zoom }} />
        )
      )}
    </View>
  );
}

/** Plain lyric text as reading lines, for a surface that holds text only. */
export function linesFromText(text: string): LyricsLine[] {
  return text.split("\n").map((lineText, index) => ({ id: `line-${index}`, text: lineText, chords: [] }));
}

export function ReadingChart({ sheet }: { sheet: ChordSheet }) {
  return (
    <View style={styles.chart}>
      {sheet.sections.map((section) =>
        section.kind === "text" ? (
          <UserText align="content" key={section.id} value={section.text ?? ""} style={styles.chartText}>
            {section.text ?? ""}
          </UserText>
        ) : (
          <ChordSheetSection
            key={section.id}
            section={section}
            editable={false}
            selectionActive={false}
            selectedMeasureIds={NO_SELECTION}
            onTapMeasure={noop}
            onLongPressMeasure={noop}
            onAddMeasure={noop}
            onNotes={noop}
            onOpenMenu={noop}
          />
        )
      )}
    </View>
  );
}

/**
 * Change key on the fly, right on the chart (founder, 2026-10-18): the shared
 * transpose control, − and + a half step, with the return-to-written-key glyph
 * once shifted. Sits pinned above the scrolling page so it stays in reach while a
 * song plays. Per song, the same key the chart editor and lyric pages use.
 */
export function ReadingTransposeBar({ ideaId }: { ideaId: string }) {
  const transpose = useChartPrefsStore((state) => state.transposeByIdeaId[ideaId] ?? 0);
  return (
    <View style={styles.transposeBar}>
      <TransposeChip
        ideaId={ideaId}
        offset={transpose}
        onNudge={(delta) => useChartPrefsStore.getState().nudgeTranspose(ideaId, delta)}
        onReset={() => useChartPrefsStore.getState().resetTranspose(ideaId)}
      />
    </View>
  );
}

/**
 * The playback-pitch reminder (founder, 2026-10-20): while the player's pitch
 * is bent, the chart says by how much, and offers the one choice a player
 * makes about it. Pitched up: keep the written shapes with a capo on that
 * fret, or switch the capo off and read the chords moved. Pitched down (no
 * capo lowers a guitar): read them as written, or moved. An octave changes no
 * chord, so it only reminds. The song's own key and capo never move.
 */
export function PlaybackKeyRow({ pitchSemitones }: { pitchSemitones: number }) {
  const { t } = useTranslation();
  const withCapo = useChartPrefsStore((state) => state.playAlongWithCapo);
  if (!pitchSemitones) return null;
  const value = signedNumberText(formatTransposeOffset(pitchSemitones));
  const { sameChords } = playbackChordShift(pitchSemitones, withCapo);
  const raised = pitchSemitones > 0;
  const setWithCapo = (next: boolean) => useChartPrefsStore.getState().setPlayAlongWithCapo(next);
  return (
    <View style={styles.playbackRow}>
      <Text
        style={styles.playbackText}
        accessibilityLabel={t("reading.playbackShiftA11y", { value })}
      >
        {t("reading.playbackShift", { value })}
      </Text>
      {sameChords ? null : (
        <View style={styles.playbackChoice}>
          <Text style={styles.playbackText}>
            {raised ? t("reading.capoShort", { fret: pitchSemitones }) : t("reading.moveChords")}
          </Text>
          <Switch
            value={raised ? withCapo : !withCapo}
            onValueChange={(next) => setWithCapo(raised ? next : !next)}
            accessibilityLabel={
              raised
                ? t("reading.capoForPlaybackA11y", { fret: pitchSemitones })
                : t("reading.moveChordsA11y")
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  playbackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
  },
  playbackChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  playbackText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  transposeBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
  },
  lyric: {
    fontFamily: "Lora_500Medium",
    color: colors.textPrimary,
  },
  chart: {
    gap: 4,
  },
  chartText: {
    fontFamily: "Lora_500Medium",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    color: colors.textSecondary,
    marginVertical: spacing.sm,
  },
});
