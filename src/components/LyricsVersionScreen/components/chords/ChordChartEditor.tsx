import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../../styles";
import { colors, radii, spacing } from "../../../../design/tokens";
import { sortedPalette } from "../../../../domain/chords";
import type { LyricsVersion, SongChordPaletteItem } from "../../../../types";
import { styles as screenStyles } from "../../styles";
import { ChordChart } from "./ChordChart";
import { ChordZoomBar } from "./ChordZoomBar";
import { ChordPaletteBar } from "./ChordPaletteBar";
import { ChordPickerSheet } from "./ChordPickerSheet";
import { HelpSheet, type HelpItem } from "../../../common/HelpSheet";
import { useChordEditing } from "./useChordEditing";
import { useTranslation } from "react-i18next";

type Props = {
  ideaId: string;
  version: LyricsVersion;
  palette: SongChordPaletteItem[] | undefined;
};

/** Edit-mode chord chart: tap a lyric to add, tap a chord to edit, drag to move,
 * or arm a palette chord and tap to drop it. Exit via the header Back; export
 * lives in the header. */
export function ChordChartEditor({ ideaId, version, palette }: Props) {
  const { t } = useTranslation();
  const helpItems: HelpItem[] = [
    { icon: "add", label: t("chordEditor.helpAdd"), description: t("chordEditor.helpAddDesc") },
    { icon: "swap-horizontal-outline", label: t("chordEditor.helpMove"), description: t("chordEditor.helpMoveDesc") },
    { icon: "create-outline", label: t("chordEditor.helpEdit"), description: t("chordEditor.helpEditDesc") },
    { icon: "text", label: t("chordEditor.helpZoom"), description: t("chordEditor.helpZoomDesc") },
  ];
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
          accessibilityLabel={t("common.help")}
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
          emptyLabel={t("chordEditor.empty")}
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
        title={t("chordEditor.helpTitle")}
        intro={t("chordEditor.helpIntro")}
        items={helpItems}
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
