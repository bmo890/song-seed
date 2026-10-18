import React from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import type { LyricsLine } from "../../../../types";
import { colors } from "../../../../design/tokens";
import { buildWordChunks } from "../../../../domain/serifChordChunks";
import {
  READING_CHORD_ROW_HEIGHT,
  READING_CHORD_SIZE,
  READING_CHORDED_LINE_HEIGHT,
  READING_LYRIC_LINE_HEIGHT,
  READING_LYRIC_SIZE,
} from "./chordChartStyle";
import { detectTextDirection, resolveContentDirection } from "../../../../i18n";

/**
 * The READING voice of the lyric-anchored chord chart (phase 3, 2026-08-06):
 * serif words under bold sans chord names in ink (2026-10-18: the terracotta
 * badges are retired; colour is scarce, and a chord is read, not pressed) —
 * one typographic identity with plain lyrics, instead of the editor's monospace.
 *
 * The editor stays monospace because its drag math needs a uniform advance
 * width (chord x = character index × char width). Reading doesn't: each line is
 * chunked into WORDS, every word renders as a column (chord above, word below),
 * and the chords ride whichever word their anchor falls inside. Words wrap as a
 * row, so the read chart breaks lines like prose and needs no horizontal
 * scroll — a chord can never detach from its word.
 */

function SerifChordLine({
  line,
  zoom,
  lineDirection,
}: {
  line: LyricsLine;
  zoom: number;
  lineDirection: "ltr" | "rtl";
}) {
  if (!line.text.trim() && line.chords.length === 0) {
    return <View style={styles.blank} />;
  }

  const lyricStyle: StyleProp<TextStyle> = [
    styles.lyric,
    { fontSize: READING_LYRIC_SIZE * zoom, lineHeight: READING_CHORDED_LINE_HEIGHT * zoom },
  ];

  // A chordless line is just words — let the platform wrap it naturally.
  if (line.chords.length === 0) {
    return (
      <Text
        style={[
          styles.lyric,
          { fontSize: READING_LYRIC_SIZE * zoom, lineHeight: READING_LYRIC_LINE_HEIGHT * zoom, direction: lineDirection },
        ]}
      >
        {line.text}
      </Text>
    );
  }
  const chordStyle: StyleProp<TextStyle> = [
    styles.chord,
    { fontSize: READING_CHORD_SIZE * zoom, lineHeight: READING_CHORD_ROW_HEIGHT * zoom },
  ];

  const chunks = buildWordChunks(line);
  // Chords on a wordless line still get their own row.
  const orphanChords = chunks.length === 0 ? line.chords.map((chord) => chord.chord) : [];
  return (
    <View
      style={[styles.line, { direction: lineDirection, columnGap: 5 * zoom, rowGap: 2 * zoom }]}
    >
      {chunks.map((chunk) => (
        <View key={chunk.key} style={styles.word}>
          {chunk.chords.length > 0 ? (
            // Several chords on one word read as a short run ("D  E  F"), not
            // a stack of chips, so a busy word barely widens.
            <Text style={chordStyle} numberOfLines={1}>
              {chunk.chords.join("  ")}
            </Text>
          ) : null}
          <Text style={lyricStyle}>{chunk.text}</Text>
        </View>
      ))}
      {orphanChords.length > 0 ? (
        <Text style={chordStyle}>{orphanChords.join("  ")}</Text>
      ) : null}
    </View>
  );
}

export function SerifChordLines({ lines, zoom = 1 }: { lines: LyricsLine[]; zoom?: number }) {
  // Direction is decided per line; opinionless lines inherit the chart's own
  // (the first line with an opinion) — same law as the monospace editor.
  const chartDirection =
    lines.reduce<ReturnType<typeof detectTextDirection>>(
      (found, line) => found ?? detectTextDirection(line.text),
      null
    ) ?? undefined;
  return (
    <View style={styles.stack}>
      {lines.map((line) => (
        <SerifChordLine
          key={line.id}
          line={line}
          zoom={zoom}
          lineDirection={resolveContentDirection(line.text, "auto", chartDirection)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 4,
  },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  word: {
    alignItems: "flex-start",
    maxWidth: "100%",
  },
  chord: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textStrong,
  },
  lyric: {
    fontFamily: "Lora_500Medium",
    color: colors.textPrimary,
  },
  blank: {
    height: 18,
  },
});
