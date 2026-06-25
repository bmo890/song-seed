import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../../common/Button";
import { colors, spacing } from "../../../../design/tokens";
import { sortedPalette } from "../../../../chords";
import type { LyricsVersion, SongChordPaletteItem } from "../../../../types";
import { styles as screenStyles } from "../../styles";
import { ChordChart } from "./ChordChart";
import { ChordPickerSheet } from "./ChordPickerSheet";
import { useChordEditing } from "./useChordEditing";

type Props = {
  ideaId: string;
  version: LyricsVersion;
  palette: SongChordPaletteItem[] | undefined;
  onDone: () => void;
};

/** Edit-mode chord chart: tap a lyric to add, tap a chord to edit, drag to move. */
export function ChordChartEditor({ ideaId, version, palette, onDone }: Props) {
  const editing = useChordEditing(ideaId, version.id);
  const sorted = sortedPalette(palette);

  return (
    <View style={screenStyles.flexFill}>
      <View style={screenStyles.lyricsVersionTopActions}>
        <Button
          label="Done"
          onPress={onDone}
          style={screenStyles.lyricsActionBtn}
          textStyle={screenStyles.lyricsActionBtnText}
        />
        <View style={chartStyles.hintRow}>
          <Ionicons name="hand-left-outline" size={13} color={colors.textMuted} />
          <Text style={chartStyles.hint}>Tap a lyric to add · tap a chord to edit · drag to move</Text>
        </View>
      </View>

      <View style={[screenStyles.lyricsPreviewWrap, screenStyles.lyricsPreviewWrapExpanded, chartStyles.chartCard]}>
        <ChordChart
          lines={version.document.lines}
          editable
          onAddAt={editing.openAdd}
          onEditChord={editing.openEdit}
          onMoveChord={editing.move}
          emptyLabel="Add lyrics first, then come back to chart the chords."
        />
      </View>

      <ChordPickerSheet
        visible={!!editing.target}
        mode={editing.target?.mode ?? "add"}
        initial={editing.target?.initial ?? null}
        palette={sorted}
        onClose={editing.close}
        onSave={editing.save}
        onDelete={editing.remove}
      />
    </View>
  );
}

const chartStyles = StyleSheet.create({
  chartCard: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: "hidden",
  },
  hintRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
  },
  hint: {
    flexShrink: 1,
    fontSize: 11,
    color: colors.textMuted,
  },
});
