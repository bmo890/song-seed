import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { ChordExportSheet } from "../../LyricsVersionScreen/components/chords/ChordExportSheet";
import { useChordSheetModel } from "../useChordSheetModel";
import { ChordSheetBody, ChordSheetFullView } from "./ChordSheetBody";
import { ChartSelectionDock } from "./ChartSelectionDock";
import { ChartScrollProvider, useChartKeyboardScroller } from "./chartScroll";

const KRAFT_BG = "#F2E9DC";

export function ChordSheetScreenContent() {
  const model = useChordSheetModel();
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const { scrollToInput, keyboardHeight } = useChartKeyboardScroller({
    scrollTo: (y) => scrollRef.current?.scrollTo({ y, animated: true }),
    getOffset: () => offsetRef.current,
  });
  const [exportVisible, setExportVisible] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);

  if (!model.projectIdea) {
    return (
      <SafeAreaView style={[styles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
        <ScreenHeader title="Chord Chart" leftIcon="back" onLeftPress={model.goBack} />
        <View style={styles.missing}>
          <Ionicons name="grid-outline" size={28} color={colors.textMuted} />
          <Text style={styles.missingText}>This song is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { sheet, isEditing } = model;
  const isEmpty = sheet.sections.length === 0;

  return (
    <SafeAreaView style={[styles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
      <ScreenHeader
        title="Chord Chart"
        leftIcon="back"
        onLeftPress={model.goBack}
        rightElement={
          <View style={styles.headerActions}>
            {isEditing ? (
              <>
                <Pressable
                  style={({ pressed }) => [styles.headerBtn, pressed && model.canUndo ? appStyles.pressDown : null]}
                  onPress={model.undo}
                  disabled={!model.canUndo}
                  hitSlop={6}
                  accessibilityLabel="Undo"
                >
                  <Ionicons
                    name="arrow-undo-outline"
                    size={18}
                    color={model.canUndo ? colors.textSecondary : colors.borderMuted}
                  />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.headerBtn, pressed && model.canRedo ? appStyles.pressDown : null]}
                  onPress={model.redo}
                  disabled={!model.canRedo}
                  hitSlop={6}
                  accessibilityLabel="Redo"
                >
                  <Ionicons
                    name="arrow-redo-outline"
                    size={18}
                    color={model.canRedo ? colors.textSecondary : colors.borderMuted}
                  />
                </Pressable>
              </>
            ) : null}
            {!isEmpty && !isEditing ? (
              <Pressable
                style={({ pressed }) => [styles.headerBtn, pressed ? appStyles.pressDown : null]}
                onPress={() => setFullViewOpen(true)}
                hitSlop={6}
                accessibilityLabel="Full view"
              >
                <Ionicons name="expand-outline" size={19} color={colors.primary} />
              </Pressable>
            ) : null}
            {!isEmpty ? (
              <Pressable
                style={({ pressed }) => [styles.headerBtn, pressed ? appStyles.pressDown : null]}
                onPress={() => setExportVisible(true)}
                hitSlop={6}
                accessibilityLabel="Export"
              >
                <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
              </Pressable>
            ) : null}
            {!isEmpty ? (
              isEditing ? (
                <Pressable
                  style={({ pressed }) => [styles.editPill, pressed ? appStyles.pressDown : null]}
                  onPress={() => model.setIsEditing(false)}
                  hitSlop={6}
                >
                  <Text style={styles.editPillText}>Done</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.editIconBtn, pressed ? appStyles.pressDown : null]}
                  onPress={() => model.setIsEditing(true)}
                  hitSlop={6}
                  accessibilityLabel="Edit"
                >
                  <Ionicons name="pencil" size={18} color={colors.onPrimary} />
                </Pressable>
              )
            ) : null}
          </View>
        }
      />

      <Text style={styles.subtitle}>{model.projectIdea.title}</Text>

      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={[
          styles.scrollContent,
          model.barSelection ? styles.scrollContentSelecting : null,
          keyboardHeight > 0 ? { paddingBottom: 48 + keyboardHeight } : null,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScroll={(e) => {
          offsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <ChartScrollProvider value={scrollToInput}>
          <ChordSheetBody model={model} />
        </ChartScrollProvider>
      </ScrollView>

      {keyboardHeight === 0 ? <ChartSelectionDock model={model} /> : null}

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

      <ChordSheetFullView
        visible={fullViewOpen}
        title={model.projectIdea.title}
        sheet={sheet}
        onClose={() => setFullViewOpen(false)}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 16 },
  fill: { flex: 1, minHeight: 0 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  editPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  editPillText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 13, color: colors.onPrimary },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: { ...textTokens.supporting, marginBottom: spacing.md },
  scrollContent: { paddingBottom: 48 },
  scrollContentSelecting: { paddingBottom: 110 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  missingText: { ...textTokens.supporting },
});
