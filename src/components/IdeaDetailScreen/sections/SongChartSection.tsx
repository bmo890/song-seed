import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing } from "../../../design/tokens";
import { useChordSheetModel } from "../../ChordSheetScreen/useChordSheetModel";
import { ChordSheetBody } from "../../ChordSheetScreen/components/ChordSheetBody";
import { ChartSelectionDock } from "../../ChordSheetScreen/components/ChartSelectionDock";
import { ChartScrollProvider, useChartKeyboardScroller } from "../../ChordSheetScreen/components/chartScroll";
import { ChordExportSheet } from "../../LyricsVersionScreen/components/chords/ChordExportSheet";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";
import { CollapsingTabStage } from "../components/CollapsingTabStage";

export function SongChartSection() {
  const { screen } = useSongScreen();
  const idea = screen.selectedIdea;
  const model = useChordSheetModel(idea?.kind === "project" ? idea.id : undefined);
  const [exportVisible, setExportVisible] = useState(false);
  const { setIsEditing, isEditing } = model;

  // Editing happens in a dedicated keyboard-safe scroll view (below); track its
  // offset so a focused note/text-block can be lifted above the keyboard.
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const { scrollToInput, keyboardHeight } = useChartKeyboardScroller({
    scrollTo: (y) => scrollRef.current?.scrollTo({ y, animated: true }),
    getOffset: () => offsetRef.current,
  });

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

  const exportSheet = (
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
  );

  // ── Edit mode: a dedicated scroll view for the whole edit region. We add the
  // keyboard height to the bottom padding (so there's room to scroll) and lift
  // the focused field above the keyboard ourselves — Android edge-to-edge no
  // longer resizes the window, so the OS won't make room on its own. ───────────
  if (isEditing) {
    return (
      <View style={appStyles.flexFill}>
        <View style={chartControls.editorBar}>
          <Pressable
            style={({ pressed }) => [chartControls.iconBtn, pressed ? appStyles.pressDown : null]}
            onPress={() => setExportVisible(true)}
            hitSlop={6}
          >
            <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [chartControls.editPill, pressed ? appStyles.pressDown : null]}
            onPress={() => setIsEditing(false)}
            hitSlop={6}
          >
            <Text style={chartControls.editPillText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={appStyles.flexFill}
          contentContainerStyle={[
            styles.songDetailTabScrollContent,
            { paddingBottom: spacing.xl + keyboardHeight },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScroll={(e) => {
            offsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <ChartScrollProvider value={scrollToInput}>
            <ChordSheetBody model={model} />
          </ChartScrollProvider>
        </ScrollView>

        {keyboardHeight === 0 ? <ChartSelectionDock model={model} /> : null}
        {exportSheet}
      </View>
    );
  }

  // ── Read-only view: the collapsing song header + tabs stay in place. ─────────
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
            onPress={() => setIsEditing(true)}
            hitSlop={6}
          >
            <Text style={chartControls.editPillText}>Edit</Text>
          </Pressable>
        </View>
      ) : null}

      <ChordSheetBody model={model} />

      {exportSheet}
    </CollapsingTabStage>
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
  editorBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
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
