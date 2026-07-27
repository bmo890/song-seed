import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";
import type { ChordPlacement, LyricsLine } from "../../../../types";
import { clampChordIndex, graphemeCount } from "../../../../domain/chords";
import { physicalEdge, physicalTextAlign, type UiDirection } from "../../../../i18n";
import { ChordToken } from "./ChordToken";
import {
  CHORD_ROW_HEIGHT,
  LYRIC_FONT_SIZE,
  LYRIC_LINE_HEIGHT,
  MONO_FONT,
  chordChartColors,
} from "./chordChartStyle";

type Props = {
  line: LyricsLine;
  charWidth: number;
  contentWidth: number;
  editable: boolean;
  /** Reading direction of THIS line's own text — chords are anchored by grapheme
   *  index, so the index has to count from the edge the line starts at. */
  lineDirection: UiDirection;
  zoom?: number;
  onAddAt?: (lineId: string, at: number) => void;
  onEditChord?: (lineId: string, chord: ChordPlacement) => void;
  onMoveChord?: (lineId: string, chordId: string, at: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
};

export function ChordLine({
  line,
  charWidth,
  contentWidth,
  editable,
  lineDirection,
  zoom = 1,
  onAddAt,
  onEditChord,
  onMoveChord,
  onDragStateChange,
}: Props) {
  const chords = line.chords ?? [];
  const showChordRow = editable || chords.length > 0;
  const lineLength = graphemeCount(line.text);
  const rtl = lineDirection === "rtl";
  // Tapping to place a chord measures from the edge the line STARTS at, so the
  // width is needed to flip the measurement on an RTL line.
  const [rowWidth, setRowWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setRowWidth(event.nativeEvent.layout.width);
  }

  function handleTapToAdd(event: GestureResponderEvent) {
    if (!editable || !onAddAt) return;
    const x = event.nativeEvent.locationX;
    const fromStart = rtl ? Math.max(rowWidth, 0) - x : x;
    const at = clampChordIndex(fromStart / Math.max(charWidth, 1), lineLength);
    onAddAt(line.id, at);
  }

  const lyricText = (
    <Text
      style={[
        styles.lyric,
        {
          fontSize: LYRIC_FONT_SIZE * zoom,
          lineHeight: LYRIC_LINE_HEIGHT * zoom,
          textAlign: physicalTextAlign(rtl ? "right" : "left"),
          writingDirection: lineDirection,
        },
      ]}
      numberOfLines={1}
      ellipsizeMode="clip"
    >
      {line.text.length > 0 ? line.text : " "}
    </Text>
  );

  return (
    <View
      style={[
        styles.line,
        // Slack past the last character sits at the END of the line, whichever
        // side that is.
        rtl ? styles.lineSlackRtl : styles.lineSlackLtr,
        { minWidth: contentWidth },
      ]}
    >
      {showChordRow ? (
        <View style={[styles.chordRow, { height: CHORD_ROW_HEIGHT * zoom }]}>
          {chords.map((chord) => (
            <ChordToken
              key={chord.id}
              chord={chord}
              charWidth={charWidth}
              lineLength={lineLength}
              editable={editable}
              rtl={rtl}
              zoom={zoom}
              onPress={() => onEditChord?.(line.id, chord)}
              onMove={(at) => onMoveChord?.(line.id, chord.id, at)}
              onDragStateChange={onDragStateChange}
            />
          ))}
        </View>
      ) : null}

      {editable ? (
        <Pressable
          onPress={handleTapToAdd}
          onLayout={handleLayout}
          style={[styles.lyricPressable, { minHeight: LYRIC_LINE_HEIGHT * zoom }]}
        >
          {lyricText}
        </Pressable>
      ) : (
        lyricText
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    marginBottom: 6,
  },
  // Physical padding, chosen per line: the chart's coordinate system is physical
  // (chords are absolutely positioned), so logical paddingStart/End would drift
  // apart from the anchors on a line whose direction differs from the UI's.
  lineSlackLtr: {
    [physicalEdge("right") === "right" ? "paddingRight" : "paddingLeft"]: 24,
  },
  lineSlackRtl: {
    [physicalEdge("left") === "left" ? "paddingLeft" : "paddingRight"]: 24,
  },
  chordRow: {
    height: CHORD_ROW_HEIGHT,
    position: "relative",
  },
  lyricPressable: {
    minHeight: LYRIC_LINE_HEIGHT,
    justifyContent: "center",
  },
  lyric: {
    fontFamily: MONO_FONT,
    fontSize: LYRIC_FONT_SIZE,
    lineHeight: LYRIC_LINE_HEIGHT,
    color: chordChartColors.lyric,
  },
});
