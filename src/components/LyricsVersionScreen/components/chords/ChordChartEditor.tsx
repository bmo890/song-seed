import { useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../../common/Button";
import { colors } from "../../../../design/tokens";
import { serializeChordChartText, serializeChordPro, sortedPalette } from "../../../../chords";
import { shareChordChartPdf } from "../../../../services/chordChartPdf";
import { formatDate } from "../../../../utils";
import { AppAlert } from "../../../common/AppAlert";
import type { LyricsVersion, SongChordPaletteItem } from "../../../../types";
import { styles as screenStyles } from "../../styles";
import { ChordChart } from "./ChordChart";
import { ChordPaletteBar } from "./ChordPaletteBar";
import { ChordPickerSheet } from "./ChordPickerSheet";
import { ChordExportSheet } from "./ChordExportSheet";
import { useChordEditing } from "./useChordEditing";

type Props = {
  ideaId: string;
  version: LyricsVersion;
  songTitle: string;
  palette: SongChordPaletteItem[] | undefined;
  onDone: () => void;
};

/** Edit-mode chord chart: tap a lyric to add, tap a chord to edit, drag to move,
 * or arm a palette chord and tap to drop it. */
export function ChordChartEditor({ ideaId, version, songTitle, palette, onDone }: Props) {
  const editing = useChordEditing(ideaId, version.id);
  const sorted = sortedPalette(palette);
  const [exportVisible, setExportVisible] = useState(false);

  const subtitle = `${songTitle} · ${formatDate(version.updatedAt)}`;

  function exportText() {
    setExportVisible(false);
    const lines = version.document.lines;
    const chart = serializeChordChartText(lines);
    if (!chart.trim()) {
      AppAlert.info("Nothing to share", "Add some lyrics and chords first.");
      return;
    }
    void Share.share({
      title: `${songTitle} — chords`,
      message: `${chart}\n\n— ChordPro —\n${serializeChordPro(lines)}`,
    });
  }

  async function exportPdf() {
    setExportVisible(false);
    try {
      const ok = await shareChordChartPdf({ title: songTitle, subtitle, lines: version.document.lines });
      if (!ok) AppAlert.info("Nothing to export", "Add some lyrics and chords first.");
    } catch {
      AppAlert.info("Export failed", "Couldn't create the PDF. Please try again.");
    }
  }

  return (
    <View style={screenStyles.flexFill}>
      <View style={screenStyles.lyricsVersionTopActions}>
        <Button
          label="Done"
          onPress={onDone}
          style={screenStyles.lyricsActionBtn}
          textStyle={screenStyles.lyricsActionBtnText}
        />
        <Button
          variant="secondary"
          label="Export"
          onPress={() => setExportVisible(true)}
          style={screenStyles.lyricsActionBtn}
          textStyle={screenStyles.lyricsActionBtnText}
        />
        <View style={chartStyles.hintRow}>
          <Ionicons name="hand-left-outline" size={13} color={colors.textMuted} />
          <Text style={chartStyles.hint} numberOfLines={1}>
            Tap a lyric · drag a chord to move
          </Text>
        </View>
      </View>

      <ChordPaletteBar palette={sorted} armedId={editing.armed?.id ?? null} onToggleArmed={editing.toggleArmed} />

      <View style={[screenStyles.lyricsPreviewWrap, screenStyles.lyricsPreviewWrapExpanded, chartStyles.chartCard]}>
        <ChordChart
          lines={version.document.lines}
          editable
          onAddAt={editing.addAt}
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

      <ChordExportSheet
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        onExportPdf={exportPdf}
        onExportText={exportText}
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
    justifyContent: "flex-end",
    gap: 5,
    flexShrink: 1,
  },
  hint: {
    flexShrink: 1,
    fontSize: 11,
    color: colors.textMuted,
  },
});
