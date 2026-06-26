import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GestureResponderEvent } from "react-native";
import type { ChordPlacement, LyricsLine } from "../../../../types";
import { clampChordIndex } from "../../../../chords";
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
  onAddAt,
  onEditChord,
  onMoveChord,
  onDragStateChange,
}: Props) {
  const chords = line.chords ?? [];
  const showChordRow = editable || chords.length > 0;
  const lineLength = line.text.length;

  function handleTapToAdd(event: GestureResponderEvent) {
    if (!editable || !onAddAt) return;
    const at = clampChordIndex(event.nativeEvent.locationX / Math.max(charWidth, 1), lineLength);
    onAddAt(line.id, at);
  }

  const lyricText = (
    <Text style={styles.lyric} numberOfLines={1} ellipsizeMode="clip">
      {line.text.length > 0 ? line.text : " "}
    </Text>
  );

  return (
    <View style={[styles.line, { minWidth: contentWidth }]}>
      {showChordRow ? (
        <View style={styles.chordRow}>
          {chords.map((chord) => (
            <ChordToken
              key={chord.id}
              chord={chord}
              charWidth={charWidth}
              lineLength={lineLength}
              editable={editable}
              onPress={() => onEditChord?.(line.id, chord)}
              onMove={(at) => onMoveChord?.(line.id, chord.id, at)}
              onDragStateChange={onDragStateChange}
            />
          ))}
        </View>
      ) : null}

      {editable ? (
        <Pressable onPress={handleTapToAdd} style={styles.lyricPressable}>
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
    // Slack past the last character so it never sits flush against the scroll edge
    // (and so a chord dragged to the end stays comfortably visible).
    paddingRight: 24,
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
