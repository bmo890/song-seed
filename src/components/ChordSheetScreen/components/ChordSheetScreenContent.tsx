import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { ChordExportSheet } from "../../LyricsVersionScreen/components/chords/ChordExportSheet";
import { useChordSheetModel } from "../useChordSheetModel";
import { ChordSheetBody, ChordSheetFullView } from "./ChordSheetBody";
import { ChartSelectionDock } from "./ChartSelectionDock";
import { ChartScrollProvider, useChartKeyboardScroller } from "./chartScroll";
import { TransposeChip } from "../../common/TransposeChip";
import { SongbookChooserSheet } from "../../common/SongbookChooserSheet";
import { useChartPrefsStore } from "../../../state/useChartPrefsStore";
import { clampTransposeOffset, transposeChordSheet } from "../../../domain/transpose";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

const KRAFT_BG = "#F2E9DC";

const transposeRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingBottom: 10,
  },
});

export function ChordSheetScreenContent() {
  const { t } = useTranslation();
  const model = useChordSheetModel();
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const { scrollToInput, keyboardHeight } = useChartKeyboardScroller({
    scrollTo: (y) => scrollRef.current?.scrollTo({ y, animated: true }),
    getOffset: () => offsetRef.current,
  });
  const [exportVisible, setExportVisible] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [songbookChooserVisible, setSongbookChooserVisible] = useState(false);
  const transposeByIdeaId = useChartPrefsStore((s) => s.transposeByIdeaId);

  if (!model.projectIdea) {
    return (
      <SafeAreaView style={[styles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
        <ScreenHeader title={t("chordChart.title")} leftIcon="back" onLeftPress={model.goBack} />
        <View style={styles.missing}>
          <Ionicons name="grid-outline" size={28} color={colors.textMuted} />
          <Text style={styles.missingText}>{t("chordChart.unavailable")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { sheet, isEditing } = model;
  const isEmpty = sheet.sections.length === 0;

  // Non-destructive display transpose (per song, persisted). Editing always
  // shows — and edits — the written key.
  const ideaId = model.projectIdea.id;
  const transpose = clampTransposeOffset(transposeByIdeaId[ideaId] ?? 0);
  const displaySheet = transposeChordSheet(sheet, transpose);

  return (
    <SafeAreaView style={[styles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("chordChart.title")}
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
                  accessibilityLabel={t("chordChart.undo")}
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
                  accessibilityLabel={t("chordChart.redo")}
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
                accessibilityLabel={t("chordChart.fullView")}
              >
                <Ionicons name="expand-outline" size={19} color={colors.primary} />
              </Pressable>
            ) : null}
            {!isEmpty ? (
              <Pressable
                style={({ pressed }) => [styles.headerBtn, pressed ? appStyles.pressDown : null]}
                onPress={() => setExportVisible(true)}
                hitSlop={6}
                accessibilityLabel={t("chordChart.export")}
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
                  <Text style={styles.editPillText}>{t("chordChart.done")}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.editIconBtn, pressed ? appStyles.pressDown : null]}
                  onPress={() => model.setIsEditing(true)}
                  hitSlop={6}
                  accessibilityLabel={t("chordChart.edit")}
                >
                  <Ionicons name="pencil" size={18} color={colors.onPrimary} />
                </Pressable>
              )
            ) : null}
          </View>
        }
      />

      <UserText value={model.projectIdea.title} style={styles.subtitle}>{model.projectIdea.title}</UserText>

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
          {!isEmpty && !isEditing ? (
            <View style={transposeRowStyles.row}>
              <TransposeChip
                offset={transpose}
                onNudge={(delta) => useChartPrefsStore.getState().nudgeTranspose(ideaId, delta)}
                onReset={() => useChartPrefsStore.getState().resetTranspose(ideaId)}
              />
            </View>
          ) : null}
          <ChordSheetBody model={model} displaySheet={displaySheet} />
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
        onAddToSongbook={
          !isEmpty
            ? () => {
                setExportVisible(false);
                setSongbookChooserVisible(true);
              }
            : undefined
        }
      />

      <SongbookChooserSheet
        visible={songbookChooserVisible}
        onClose={() => setSongbookChooserVisible(false)}
        items={[{ kind: "chordChart" }]}
        ideaId={ideaId}
        ideaTitle={model.projectIdea.title}
      />

      <ChordSheetFullView
        visible={fullViewOpen}
        title={model.projectIdea.title}
        sheet={displaySheet}
        onClose={() => setFullViewOpen(false)}
      />

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
