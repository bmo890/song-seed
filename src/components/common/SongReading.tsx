import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../../design/tokens";
import type { ChordSheet, LyricsLine } from "../../types";
import { UserText } from "../../i18n";
import { SerifChordLines } from "../LyricsVersionScreen/components/chords/SerifChordChart";
import {
  READING_LYRIC_LINE_HEIGHT,
  READING_LYRIC_SIZE,
} from "../LyricsVersionScreen/components/chords/chordChartStyle";
import { ChordSheetSection } from "../ChordSheetScreen/ChordSheetSection";

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

const styles = StyleSheet.create({
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
