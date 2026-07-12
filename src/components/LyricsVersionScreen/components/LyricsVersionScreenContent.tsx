import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors, radii } from "../../../design/tokens";
import { styles } from "../styles";
import { ScreenHeader } from "../../common/ScreenHeader";
import { useLyricsVersionScreenModel } from "../hooks/useLyricsVersionScreenModel";
import { LyricsVersionEditor } from "./LyricsVersionEditor";
import { LyricsVersionPreview } from "./LyricsVersionPreview";
import { LyricsVersionUnavailableState } from "./LyricsVersionUnavailableState";
import { ChordChartEditor } from "./chords/ChordChartEditor";
import { ChordExportSheet } from "./chords/ChordExportSheet";
import { useChordExport } from "./chords/useChordExport";

export function LyricsVersionScreenContent() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const model = useLyricsVersionScreenModel();
  const [chordEditMode, setChordEditMode] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);

  // "Back" steps up exactly one level: an edit mode returns to the version view;
  // the version view returns to the song. (cancelEdit confirms if there are
  // unsaved lyric edits; the beforeRemove guard covers a brand-new draft.)
  function handleBack() {
    if (chordEditMode) {
      setChordEditMode(false);
      return;
    }
    if (model.isEditMode) {
      if (model.resolvedVersion) {
        model.cancelEdit();
      } else {
        navigation.goBack();
      }
      return;
    }
    navigation.goBack();
  }
  const { exportPdf, exportText } = useChordExport(
    model.projectIdea?.title ?? "",
    model.resolvedVersion
  );

  const resolvedVersionId = model.resolvedVersion?.id;
  // Leave chord-edit mode whenever the underlying version changes or text editing begins.
  useEffect(() => {
    setChordEditMode(false);
  }, [resolvedVersionId, model.isEditMode]);

  if (!model.projectIdea) return <LyricsVersionUnavailableState />;

  const lines = model.resolvedVersion?.document.lines ?? [];
  const hasChords = lines.some((line) => line.chords.length > 0);
  const canChart = !!model.resolvedVersion && lines.length > 0;
  const showChordEditor = chordEditMode && !model.isEditMode && !!model.resolvedVersion;
  // Export lives in the header for both reading and charting chords (a version
  // exists in both); only the plain-text lyric editor hides it.
  const canExport = !model.isEditMode;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={model.versionLabel}
        leftIcon="back"
        onLeftPress={handleBack}
        rightElement={
          canExport ? (
            <Pressable
              style={({ pressed }) => [headerStyles.exportBtn, pressed ? styles.pressDown : null]}
              onPress={() => setExportVisible(true)}
              hitSlop={6}
              accessibilityLabel="Export"
            >
              <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          ) : undefined
        }
      />

      <Text style={styles.subtitle}>
        {model.projectIdea.title} · {model.versionMeta}
      </Text>

      <KeyboardAvoidingView
        style={[styles.flexFill, { paddingBottom: model.isKeyboardVisible ? 0 : insets.bottom }]}
        behavior="height"
        keyboardVerticalOffset={model.topInset}
      >
        {model.isEditMode ? (
          <LyricsVersionEditor
            draftText={model.draftText}
            canSave={model.canSave}
            showSaveAsNew={!!model.resolvedVersion && model.isLatestSource && !model.editSavesAsNew}
            canUndo={model.canUndoDraft}
            canRedo={model.canRedoDraft}
            onUndo={model.undoDraft}
            onRedo={model.redoDraft}
            onChangeText={model.handleDraftTextChange}
            onSave={() => model.saveDraft()}
            onSaveAsNew={() => model.saveDraft(true)}
            onLayout={model.setEditorViewportHeight}
            onContentSizeChange={model.handleEditorContentSize}
            onScroll={model.handleEditorScroll}
            scrollIndicator={model.renderScrollIndicator(
              model.editorViewportHeight,
              model.editorContentHeight,
              model.editorScrollY
            )}
          />
        ) : showChordEditor ? (
          <ChordChartEditor
            ideaId={model.projectIdea.id}
            version={model.resolvedVersion!}
            palette={model.projectIdea.chordPalette}
          />
        ) : (
          <LyricsVersionPreview
            sourceText={model.sourceText}
            lines={lines}
            hasChords={hasChords}
            canChart={canChart}
            onEdit={model.beginEdit}
            onChords={() => setChordEditMode(true)}
            onLayout={model.setPreviewViewportHeight}
            onContentSizeChange={model.setPreviewContentHeight}
            onScroll={model.setPreviewScrollY}
            scrollIndicator={model.renderScrollIndicator(
              model.previewViewportHeight,
              model.previewContentHeight,
              model.previewScrollY
            )}
          />
        )}
      </KeyboardAvoidingView>

      <ChordExportSheet
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        onExportPdf={() => {
          setExportVisible(false);
          void exportPdf();
        }}
        onExportText={() => {
          setExportVisible(false);
          exportText();
        }}
        onCopy={() => {
          setExportVisible(false);
          model.copyText();
        }}
      />

    </SafeAreaView>
  );
}

const headerStyles = StyleSheet.create({
  exportBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
});
