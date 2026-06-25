import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ChordPlacement, LyricsLine } from "../../../../types";
import { ChordLine } from "./ChordLine";
import { LYRIC_FONT_SIZE, MEASURE_SAMPLE, MONO_FONT, chordChartColors } from "./chordChartStyle";

type Props = {
  lines: LyricsLine[];
  editable: boolean;
  onAddAt?: (lineId: string, at: number) => void;
  onEditChord?: (lineId: string, chord: ChordPlacement) => void;
  onMoveChord?: (lineId: string, chordId: string, at: number) => void;
  emptyLabel?: string;
};

/** Renders a chord-over-lyrics chart. Measures the monospace advance width once,
 * then positions every chord by `at * charWidth`. Long lines scroll horizontally
 * as a block (like a printed chart); horizontal scroll pauses while a chord is
 * being dragged so the two horizontal gestures don't fight. */
export function ChordChart({ lines, editable, onAddAt, onEditChord, onMoveChord, emptyLabel }: Props) {
  const [charWidth, setCharWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragging, setDragging] = useState(false);

  const hasLyrics = lines.some((line) => line.text.trim().length > 0) || lines.length > 0;

  const longestUnit = lines.reduce((max, line) => {
    const textUnits = line.text.length;
    const chordUnits = line.chords.reduce((m, chord) => Math.max(m, chord.at + chord.chord.length + 1), 0);
    return Math.max(max, textUnits, chordUnits);
  }, 0);
  const measuredContentWidth = charWidth > 0 ? longestUnit * charWidth + 24 : 0;
  const contentWidth = Math.max(measuredContentWidth, containerWidth);

  return (
    <View style={styles.fill} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
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

      {!hasLyrics ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{emptyLabel ?? "No lyrics in this version yet."}</Text>
        </View>
      ) : charWidth <= 0 ? null : (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.vContent}
          showsVerticalScrollIndicator={false}
        >
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
        </ScrollView>
      )}
    </View>
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
