import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { styles as appStyles } from "../../../styles";
import { spacing } from "../../../design/tokens";
import { useChordSheetModel } from "../../ChordSheetScreen/useChordSheetModel";
import { ChordSheetBody, ChordSheetFullView } from "../../ChordSheetScreen/components/ChordSheetBody";
import { IconButton } from "../../common/IconButton";
import { Button } from "../../common/Button";
import { ChartSelectionDock } from "../../ChordSheetScreen/components/ChartSelectionDock";
import { ChartScrollProvider, useChartKeyboardScroller } from "../../ChordSheetScreen/components/chartScroll";
import { ChordExportSheet } from "../../LyricsVersionScreen/components/chords/ChordExportSheet";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";
import { CollapsingTabStage } from "../components/CollapsingTabStage";
import { useTranslation } from "react-i18next";
import { TransposeChip } from "../../common/TransposeChip";
import { useChartPrefsStore } from "../../../state/useChartPrefsStore";
import { clampTransposeOffset, transposeChordSheet } from "../../../domain/transpose";

export function SongChartSection() {
  const { t } = useTranslation();
  const { screen } = useSongScreen();
  const idea = screen.selectedIdea;
  // The player's chart pencil asks for the editor, not the reader: the token
  // seeds edit mode on a fresh mount and flips it on a page already open.
  const route = useRoute<any>();
  const chartEditToken = route.params?.chartEditToken as number | undefined;
  const model = useChordSheetModel(idea?.kind === "project" ? idea.id : undefined, {
    startEditing: !!chartEditToken && route.params?.initialSongTab === "chart",
  });
  const [exportVisible, setExportVisible] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const { setIsEditing, isEditing } = model;
  // Change key on the fly in the read view (founder, 2026-10-18), the same
  // per-song display transpose the chart page, player and songbook use. Editing
  // always shows, and edits, the written key.
  const transposeIdeaId = idea?.kind === "project" ? idea.id : null;
  const transpose = useChartPrefsStore((st) =>
    transposeIdeaId ? clampTransposeOffset(st.transposeByIdeaId[transposeIdeaId] ?? 0) : 0
  );

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

  const seenEditToken = useRef(chartEditToken);
  useEffect(() => {
    if (!chartEditToken || chartEditToken === seenEditToken.current) return;
    seenEditToken.current = chartEditToken;
    setIsEditing(true);
  }, [chartEditToken, setIsEditing]);

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
          <View style={chartControls.editorGroup}>
            <IconButton
              icon="arrow-undo-outline"
              tone="muted"
              size={18}
              disabled={!model.canUndo}
              onPress={model.undo}
              accessibilityLabel={t("chordChart.undo")}
            />
            <IconButton
              icon="arrow-redo-outline"
              tone="muted"
              size={18}
              disabled={!model.canRedo}
              onPress={model.redo}
              accessibilityLabel={t("chordChart.redo")}
            />
          </View>
          <View style={chartControls.editorGroup}>
            <IconButton
              icon="share-outline"
              tone="muted"
              size={18}
              onPress={() => setExportVisible(true)}
              accessibilityLabel={t("chordChart.export")}
            />
            {/* Soft key, not a stadium pill — the button language retired round
                on text buttons (2026-07-24). */}
            <Button
              label={t("common.done")}
              variant="primary"
              onPress={() => setIsEditing(false)}
            />
          </View>
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
  const displaySheet = transpose ? transposeChordSheet(model.sheet, transpose) : model.sheet;
  return (
    <>
      <CollapsingTabStage
        contentContainerStyle={[
          styles.songDetailTabScrollContent,
          { paddingBottom: screen.songPageBaseBottomPadding },
        ]}
      >
        {!isEmpty ? (
          // Bare glyphs on the trailing edge — the same toolbar language the
          // Takes tab speaks. The old row was three tinted circles with a solid
          // terracotta pencil, which borrowed the record FAB's identity for an
          // edit action and made the sibling tabs look like different apps.
          <View style={chartControls.row}>
            {transposeIdeaId ? (
              <TransposeChip
                ideaId={transposeIdeaId}
                offset={transpose}
                onNudge={(delta) => useChartPrefsStore.getState().nudgeTranspose(transposeIdeaId, delta)}
                onReset={() => useChartPrefsStore.getState().resetTranspose(transposeIdeaId)}
              />
            ) : null}
            <View style={chartControls.spacer} />
            <IconButton
              icon="expand-outline"
              tone="muted"
              size={19}
              onPress={() => setFullViewOpen(true)}
              accessibilityLabel={t("chordChart.fullView")}
            />
            <IconButton
              icon="share-outline"
              tone="muted"
              size={18}
              onPress={() => setExportVisible(true)}
              accessibilityLabel={t("chordChart.export")}
            />
            <IconButton
              icon="pencil"
              tone="muted"
              size={18}
              onPress={() => setIsEditing(true)}
              accessibilityLabel={t("chordChart.edit")}
            />
          </View>
        ) : null}

        <ChordSheetBody model={model} displaySheet={displaySheet} />

        {exportSheet}
      </CollapsingTabStage>

      <ChordSheetFullView
        visible={fullViewOpen}
        title={model.projectIdea?.title ?? t("songDetail.chartFallback")}
        sheet={displaySheet}
        onClose={() => setFullViewOpen(false)}
      />
    </>
  );
}

const chartControls = StyleSheet.create({
  // Glyphs sit quietly on the trailing edge, same as the Takes toolbar.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 38,
    marginBottom: spacing.sm,
  },
  spacer: {
    flex: 1,
  },
  editorBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  editorGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
