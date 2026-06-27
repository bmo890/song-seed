import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Text } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
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
  const model = useLyricsVersionScreenModel();
  const [chordEditMode, setChordEditMode] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
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

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScreenHeader title={model.versionLabel} leftIcon="back" />

      <Text style={styles.subtitle}>{model.versionMeta}</Text>

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
            onChangeText={model.setDraftText}
            onSave={() => model.saveDraft()}
            onSaveAsNew={() => model.saveDraft(true)}
            onCancel={model.cancelEdit}
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
            songTitle={model.projectIdea.title}
            palette={model.projectIdea.chordPalette}
            onDone={() => setChordEditMode(false)}
          />
        ) : (
          <LyricsVersionPreview
            sourceText={model.sourceText}
            lines={lines}
            hasChords={hasChords}
            canChart={canChart}
            showNewDraft={model.isLatestSource}
            onEdit={model.beginEdit}
            onChords={() => setChordEditMode(true)}
            onNewDraft={model.beginNewDraft}
            onExport={() => setExportVisible(true)}
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

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
