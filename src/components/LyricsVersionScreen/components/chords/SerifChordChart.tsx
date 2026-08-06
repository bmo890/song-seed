import React from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import type { LyricsLine } from "../../../../types";
import { colors } from "../../../../design/tokens";
import { buildWordChunks } from "../../../../domain/serifChordChunks";
import { detectTextDirection, resolveContentDirection } from "../../../../i18n";

/**
 * The READING voice of the lyric-anchored chord chart (phase 3, 2026-08-06):
 * serif words under sans chord badges — one typographic identity with plain
 * lyrics, instead of the editor's monospace.
 *
 * The editor stays monospace because its drag math needs a uniform advance
 * width (chord x = character index × char width). Reading doesn't: each line is
 * chunked into WORDS, every word renders as a column (badge above, word below),
 * and the chords ride whichever word their anchor falls inside. Words wrap as a
 * row, so the read chart breaks lines like prose and needs no horizontal
 * scroll — a chord can never detach from its word.
 */

const CHORD_BADGE_RADIUS = 5;

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
    { fontSize: 17 * zoom, lineHeight: 24 * zoom },
  ];

  // A chordless line is just words — let the platform wrap it naturally.
  if (line.chords.length === 0) {
    return <Text style={[lyricStyle, { direction: lineDirection }]}>{line.text}</Text>;
  }

  const chunks = buildWordChunks(line);
  // Chords on a wordless line still deserve a row of badges.
  const orphanChords = chunks.length === 0 ? line.chords.map((chord) => chord.chord) : [];
  return (
    <View
      style={[styles.line, { direction: lineDirection, columnGap: 5.5 * zoom, rowGap: 3 * zoom }]}
    >
      {chunks.map((chunk) => (
        <View key={chunk.key} style={styles.word}>
          {chunk.chords.length > 0 ? (
            <View style={styles.badgeRow}>
              {chunk.chords.map((chord, index) => (
                <View key={`${chunk.key}-${index}`} style={styles.badge}>
                  <Text style={[styles.badgeText, { fontSize: 10.5 * zoom }]}>{chord}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={lyricStyle}>{chunk.text}</Text>
        </View>
      ))}
      {orphanChords.length > 0 ? (
        <View style={styles.badgeRow}>
          {orphanChords.map((chord, index) => (
            <View key={`orphan-${index}`} style={styles.badge}>
              <Text style={[styles.badgeText, { fontSize: 10.5 * zoom }]}>{chord}</Text>
            </View>
          ))}
        </View>
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
  badgeRow: {
    flexDirection: "row",
    gap: 3,
    marginBottom: 2,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: CHORD_BADGE_RADIUS,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  badgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.onPrimary,
  },
  lyric: {
    fontFamily: "Lora_500Medium",
    color: colors.textPrimary,
  },
  blank: {
    height: 16,
  },
});
