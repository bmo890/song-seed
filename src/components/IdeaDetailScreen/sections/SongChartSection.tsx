import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing } from "../../../design/tokens";
import { useChordSheetModel } from "../../ChordSheetScreen/useChordSheetModel";
import { ChordSheetBody } from "../../ChordSheetScreen/components/ChordSheetBody";
import { ChartSelectionDock } from "../../ChordSheetScreen/components/ChartSelectionDock";
import { ChartScrollProvider, type ScrollInputIntoView } from "../../ChordSheetScreen/components/chartScroll";
import { ChordExportSheet } from "../../LyricsVersionScreen/components/chords/ChordExportSheet";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";
import { CollapsingTabStage } from "../components/CollapsingTabStage";

export function SongChartSection() {
  const { screen } = useSongScreen();
  const idea = screen.selectedIdea;
  const model = useChordSheetModel(idea?.kind === "project" ? idea.id : undefined);
  const [exportVisible, setExportVisible] = useState(false);
  const { setIsEditing } = model;

  // Scroll a focused note/text-block input above the keyboard (the collapsing
  // header's scroll only insets for the keyboard, it doesn't scroll the field in).
  const scrollRef = useRef<any>(null);
  const scrollIntoView = useCallback<ScrollInputIntoView>((node) => {
    if (node == null) return;
    const responder = (scrollRef.current as any)?.getScrollResponder?.();
    responder?.scrollResponderScrollNativeHandleToKeyboard?.(node, 90, true);
  }, []);

  // Leaving the chart tab (or the whole song screen) ends edit mode, so coming
  // back lands in read-only view and nothing gets changed by accident.
  useEffect(() => {
    if (screen.songTab !== "chart") setIsEditing(false);
  }, [screen.songTab, setIsEditing]);

  useFocusEffect(
    useCallback(() => {
      return () => setIsEditing(false);
    }, [setIsEditing])
  );

  if (idea?.kind !== "project" || screen.songTab !== "chart") {
    return null;
  }

  const isEmpty = model.sheet.sections.length === 0;

  return (
    <>
      <CollapsingTabStage
        scrollRef={scrollRef}
        contentContainerStyle={[
          styles.songDetailTabScrollContent,
          { paddingBottom: screen.songPageBaseBottomPadding + (model.barSelection ? 80 : 0) },
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

      <ChartScrollProvider value={scrollIntoView}>
        <ChordSheetBody model={model} />
      </ChartScrollProvider>

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
      <ChartSelectionDock model={model} />
    </>
  );
}

const chartControls = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "flex-end",
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
  editPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  editPillText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 13, color: colors.primary },
});
