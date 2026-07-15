import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../../styles";
import { colors, radii, spacing } from "../../../../design/tokens";
import { sortedPalette } from "../../../../chords";
import type { LyricsVersion, SongChordPaletteItem } from "../../../../types";
import { styles as screenStyles } from "../../styles";
import { ChordChart } from "./ChordChart";
import { ChordZoomBar } from "./ChordZoomBar";
import { ChordPaletteBar } from "./ChordPaletteBar";
import { ChordPickerSheet } from "./ChordPickerSheet";
import { HelpSheet, type HelpItem } from "../../../common/HelpSheet";
import { useChordEditing } from "./useChordEditing";

type Props = {
  ideaId: string;
  version: LyricsVersion;
  palette: SongChordPaletteItem[] | undefined;
};

const HELP_ITEMS: HelpItem[] = [
  { icon: "add", label: "Add a chord", description: "Tap a word where you want the chord to sit." },
  { icon: "swap-horizontal-outline", label: "Move a chord", description: "Drag a chord left or right along the line." },
  { icon: "create-outline", label: "Edit a chord", description: "Tap a chord to change or remove it." },
  { icon: "text", label: "Zoom", description: "Drag the slider to fit a long line on screen." },
];

/** Edit-mode chord chart: tap a lyric to add, tap a chord to edit, drag to move,
 * or arm a palette chord and tap to drop it. Exit via the header Back; export
 * lives in the header. */
export function ChordChartEditor({ ideaId, version, palette }: Props) {
  const editing = useChordEditing(ideaId, version.id);
  const sorted = sortedPalette(palette);
  const [helpVisible, setHelpVisible] = useState(false);
  const [zoom, setZoom] = useState(1);

  return (
    <View style={screenStyles.flexFill}>
      <View style={chartControls.row}>
        <Pressable
          style={({ pressed }) => [chartControls.iconBtn, pressed ? appStyles.pressDown : null]}
          onPress={() => setHelpVisible(true)}
          hitSlop={6}
          accessibilityLabel="Help"
        >
          <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ChordPaletteBar palette={sorted} armedId={editing.armed?.id ?? null} onToggleArmed={editing.toggleArmed} />

      <View style={[screenStyles.lyricsPreviewWrap, screenStyles.lyricsPreviewWrapExpanded, chartStyles.chartCardEdit]}>
        <ChordChart
          lines={version.document.lines}
          editable
          zoom={zoom}
          onAddAt={editing.addAt}
          onEditChord={editing.openEdit}
          onMoveChord={editing.move}
          emptyLabel="Add lyrics first, then come back to chart the chords."
        />
        <ChordZoomBar zoom={zoom} onChange={setZoom} />
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

      <HelpSheet
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Charting chords"
        intro="Place chords above the words, then fine-tune by dragging."
        items={HELP_ITEMS}
      />
    </View>
  );
}

const chartControls = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
});

const chartStyles = StyleSheet.create({
  // Edit mode reads as a white, dashed "you're editing" surface — mirrors the
  // words editor — and sits inset rather than edge-to-edge.
  chartCardEdit: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: colors.textMuted,
    borderStyle: "dashed",
    borderRadius: 4,
    overflow: "hidden",
  },
});
