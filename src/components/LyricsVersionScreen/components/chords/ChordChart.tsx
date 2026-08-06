import { useState } from "react";
import { I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ChordPlacement, LyricsLine } from "../../../../types";
import { ChordLine } from "./ChordLine";
import { SerifChordLines } from "./SerifChordChart";
import { LYRIC_FONT_SIZE, MEASURE_SAMPLE, MONO_FONT, chordChartColors } from "./chordChartStyle";
import { chordGraphemeAnchor, graphemeCount } from "../../../../domain/chords";
import { detectTextDirection, resolveContentDirection } from "../../../../i18n";

type LinesProps = {
  lines: LyricsLine[];
  editable: boolean;
  /** Font-zoom multiplier (1 = natural). Scales char width + font sizes together
   * so chords stay aligned at any zoom. */
  zoom?: number;
  onAddAt?: (lineId: string, at: number) => void;
  onEditChord?: (lineId: string, chord: ChordPlacement) => void;
  onMoveChord?: (lineId: string, chordId: string, at: number) => void;
};

/** The chart body. READING renders the serif voice (sans badges over Lora
 * lines — one identity with plain lyrics); EDITING keeps the monospace grid,
 * whose uniform advance width is what the chord drag math anchors to. Neither
 * owns a vertical scroll, so both drop inside any vertical scroller (the lyric
 * sheet's, or the player/recording autoscroll panel). */
export function ChordChartLines({ lines, editable, zoom = 1, onAddAt, onEditChord, onMoveChord }: LinesProps) {
  if (!editable) {
    return <SerifChordLines lines={lines} zoom={zoom} />;
  }
  return (
    <MonoChordChartLines
      lines={lines}
      editable={editable}
      zoom={zoom}
      onAddAt={onAddAt}
      onEditChord={onEditChord}
      onMoveChord={onMoveChord}
    />
  );
}

function MonoChordChartLines({ lines, editable, zoom = 1, onAddAt, onEditChord, onMoveChord }: LinesProps) {
  const [charWidth, setCharWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragging, setDragging] = useState(false);

  // charWidth is measured at the base font; scaling it by zoom keeps every metric
  // (positions, line width) proportional to the zoomed lyric/chord text.
  const scaledCharWidth = charWidth * zoom;

  // A chart can hold Hebrew and English lines side by side, so direction is
  // decided PER LINE. Lines with no strong characters (blank, punctuation, "la
  // la") inherit the chart's own direction — the first line that has an opinion —
  // so an empty line doesn't flip its chords to the other edge.
  const chartDirection =
    lines.reduce<ReturnType<typeof detectTextDirection>>(
      (found, line) => found ?? detectTextDirection(line.text),
      null
    ) ?? undefined;

  const longestUnit = lines.reduce((max, line) => {
    const textUnits = graphemeCount(line.text);
    const chordUnits = line.chords.reduce((m, chord) => Math.max(m, chordGraphemeAnchor(chord, line.text) + chord.chord.length + 1), 0);
    return Math.max(max, textUnits, chordUnits);
  }, 0);
  // Extra character-widths of slack so the longest lyric line never clips, and so
  // there's room to drag a chord a little past the final character.
  const measuredContentWidth = scaledCharWidth > 0 ? longestUnit * scaledCharWidth + scaledCharWidth * 4 + 24 : 0;
  const contentWidth = Math.max(measuredContentWidth, containerWidth);

  return (
    // The chart's own axis follows its LYRICS, not the app's language: an English
    // song opened in a Hebrew UI still lays out left → right, so its chords land
    // over its words. Without this the whole chart mirrors while the monospace
    // anchoring stays physical, and every chord drifts to the far edge.
    <View
      style={{ direction: chartDirection ?? (I18nManager.isRTL ? "rtl" : "ltr") }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
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
          contentContainerStyle={{ minWidth: contentWidth }}
        >
          <View style={{ minWidth: contentWidth }}>
            {lines.map((line) => (
              <ChordLine
                key={line.id}
                line={line}
                charWidth={scaledCharWidth}
                contentWidth={contentWidth}
                editable={editable}
                lineDirection={resolveContentDirection(line.text, "auto", chartDirection)}
                zoom={zoom}
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
