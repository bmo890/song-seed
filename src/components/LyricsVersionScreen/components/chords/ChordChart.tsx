import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ChordPlacement, LyricsLine } from "../../../../types";
import { ChordLine } from "./ChordLine";
import { LYRIC_FONT_SIZE, MEASURE_SAMPLE, MONO_FONT, chordChartColors } from "./chordChartStyle";

type LinesProps = {
  lines: LyricsLine[];
  editable: boolean;
  onAddAt?: (lineId: string, at: number) => void;
  onEditChord?: (lineId: string, chord: ChordPlacement) => void;
  onMoveChord?: (lineId: string, chordId: string, at: number) => void;
};

/** The chart body — measuring text + a horizontally-scrolling column of lines.
 * Has no vertical scroll of its own, so it can be dropped inside any vertical
 * scroller (the lyric sheet's, or the player/recording autoscroll panel). */
export function ChordChartLines({ lines, editable, onAddAt, onEditChord, onMoveChord }: LinesProps) {
  const [charWidth, setCharWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragging, setDragging] = useState(false);

  const longestUnit = lines.reduce((max, line) => {
    const textUnits = line.text.length;
    const chordUnits = line.chords.reduce((m, chord) => Math.max(m, chord.at + chord.chord.length + 1), 0);
    return Math.max(max, textUnits, chordUnits);
  }, 0);
  // Extra character-widths of slack so the longest lyric line never clips, and so
  // there's room to drag a chord a little past the final character.
  const measuredContentWidth = charWidth > 0 ? longestUnit * charWidth + charWidth * 4 + 24 : 0;
  const contentWidth = Math.max(measuredContentWidth, containerWidth);

  return (
    <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {/* Hidden measuring text — gives us the exact monospace advance width. */}
      <Text
        style={styles.measure}
        onLayout={(e) => {
          const next = e.nativeEvent.layout.width / MEASURE_SAMPLE.length;
          if (next > 0 && Math.abs(next - charWidth) > 0.01) setCharWidth(next);
        }}
      >
        {MEASURE_SAMPLE}
      </Text>

      {charWidth <= 0 ? null : (
        <ScrollView
          horizontal
          scrollEnabled={!dragging}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ width: contentWidth }}
        >
          <View style={{ width: contentWidth }}>
            {lines.map((line) => (
              <ChordLine
                key={line.id}
                line={line}
                charWidth={charWidth}
                contentWidth={contentWidth}
                editable={editable}
                onAddAt={onAddAt}
                onEditChord={onEditChord}
                onMoveChord={onMoveChord}
                onDragStateChange={setDragging}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

type Props = LinesProps & { emptyLabel?: string };

/** Standalone chord chart with its own vertical scroll + empty state, used as the
 * lyric sheet's read/edit surface. */
export function ChordChart({ emptyLabel, ...lineProps }: Props) {
  const hasLyrics = lineProps.lines.length > 0;

  if (!hasLyrics) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyLabel ?? "No lyrics in this version yet."}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.vContent} showsVerticalScrollIndicator={false}>
      <ChordChartLines {...lineProps} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    minHeight: 0,
  },
  measure: {
    position: "absolute",
    opacity: 0,
    top: -9999,
    left: 0,
    fontFamily: MONO_FONT,
    fontSize: LYRIC_FONT_SIZE,
  },
  vContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: chordChartColors.addHint,
    textAlign: "center",
  },
});
