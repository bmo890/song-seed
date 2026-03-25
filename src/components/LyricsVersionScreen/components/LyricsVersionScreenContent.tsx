import { KeyboardAvoidingView, Text } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { styles } from "../styles";
import { ScreenHeader } from "../../common/ScreenHeader";
import { AppBreadcrumbs } from "../../common/AppBreadcrumbs";
import { useLyricsVersionScreenModel } from "../hooks/useLyricsVersionScreenModel";
import { LyricsVersionEditor } from "./LyricsVersionEditor";
import { LyricsVersionPreview } from "./LyricsVersionPreview";
import { LyricsVersionUnavailableState } from "./LyricsVersionUnavailableState";

export function LyricsVersionScreenContent() {
  const insets = useSafeAreaInsets();
  const model = useLyricsVersionScreenModel();

  if (!model.projectIdea) return <LyricsVersionUnavailableState />;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScreenHeader title={model.versionLabel} leftIcon="back" />

      {model.breadcrumbItems.length > 0 ? <AppBreadcrumbs items={model.breadcrumbItems} /> : null}

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
        ) : (
          <LyricsVersionPreview
            sourceText={model.sourceText}
            showNewDraft={model.isLatestSource}
            onEdit={model.beginEdit}
            onNewDraft={model.beginNewDraft}
            onCopy={model.copyText}
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

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
