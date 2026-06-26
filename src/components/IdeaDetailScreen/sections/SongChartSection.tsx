import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing } from "../../../design/tokens";
import { useChordSheetModel } from "../../ChordSheetScreen/useChordSheetModel";
import { ChordSheetBody } from "../../ChordSheetScreen/components/ChordSheetBody";
import { ChordExportSheet } from "../../LyricsVersionScreen/components/chords/ChordExportSheet";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";
import { CollapsingTabStage } from "../components/CollapsingTabStage";

export function SongChartSection() {
  const { screen } = useSongScreen();
  const idea = screen.selectedIdea;
  const model = useChordSheetModel(idea?.kind === "project" ? idea.id : undefined);
  const [exportVisible, setExportVisible] = useState(false);

  if (idea?.kind !== "project" || screen.isEditMode || screen.songTab !== "chart") {
    return null;
  }

  const isEmpty = model.sheet.sections.length === 0;

  return (
    <CollapsingTabStage
      contentContainerStyle={[
        styles.songDetailTabScrollContent,
        { paddingBottom: screen.songPageBaseBottomPadding },
      ]}
    >
      {!isEmpty ? (
        <View style={chartControls.row}>
          <Pressable
            style={({ pressed }) => [chartControls.iconBtn, pressed ? appStyles.pressDown : null]}
            onPress={() => setExportVisible(true)}
            hitSlop={6}
          >
            <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [chartControls.editPill, pressed ? appStyles.pressDown : null]}
            onPress={() => model.setIsEditing(!model.isEditing)}
            hitSlop={6}
          >
            <Text style={chartControls.editPillText}>{model.isEditing ? "Done" : "Edit"}</Text>
          </Pressable>
        </View>
      ) : null}

      <ChordSheetBody model={model} />

      <ChordExportSheet
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        onExportPdf={() => {
          setExportVisible(false);
          void model.exportPdf();
        }}
        onExportText={() => {
          setExportVisible(false);
          model.exportText();
        }}
      />
    </CollapsingTabStage>
  );
}

const chartControls = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  editPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  editPillText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 13, color: colors.primary },
});
