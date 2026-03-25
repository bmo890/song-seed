import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { clipLineageStyles, styles } from "../styles";
import { fmtDuration, formatDate } from "../../../utils";
import { ClipActionsSheet } from "../../modals/ClipActionsSheet";
import { ClipNotesSheet } from "../../modals/ClipNotesSheet";
import { AppAlert } from "../../common/AppAlert";
import { useClipLineageScreenModel } from "../hooks/useClipLineageScreenModel";
import { ClipLineageHeader } from "./ClipLineageHeader";
import { ClipLineageSortToggle } from "./ClipLineageSortToggle";
import { ClipLineageList } from "./ClipLineageList";

export function ClipLineageScreenContent() {
  const model = useClipLineageScreenModel();

  if (!model.idea || !model.lineage || !model.clipCardContext) {
    return (
      <SafeAreaView style={[styles.screen, styles.screenProjectDetail]}>
        <View style={clipLineageStyles.emptyState}>
          <Text style={styles.emptyText}>Lineage not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, styles.screenProjectDetail]}>
      <ClipLineageHeader
        title={model.lineageTitle}
        subtitle={`${model.clipCount} ${model.clipCount === 1 ? "take" : "takes"} · ${model.idea.title}`}
        onBack={model.goBack}
      />
      <ClipLineageSortToggle sortMode={model.sortMode} onChangeMode={model.setSortMode} />
      <ClipLineageList
        sortMode={model.sortMode}
        clipEntries={model.clipEntries}
        clipCardContext={model.clipCardContext}
        bottomPadding={24 + Math.max(model.insets.bottom, 16)}
        onDragEnd={model.handleDragEnd}
      />

      <ClipActionsSheet
        visible={!!model.actionsClip}
        title={model.actionsClip?.title ?? "Clip actions"}
        subtitle={
          model.actionsClip
            ? `${model.actionsClip.durationMs ? fmtDuration(model.actionsClip.durationMs) : "0:00"} · ${formatDate(model.actionsClip.createdAt)}`
            : undefined
        }
        onCancel={() => model.setActionsClipId(null)}
        actions={
          model.actionsClip
            ? [
                {
                  key: "record-variation",
                  label: "Record variation",
                  icon: "mic-outline" as const,
                  onPress: () => {
                    void model.openRecordingVariation(model.actionsClip!);
                  },
                },
                {
                  key: "rename",
                  label: "Rename",
                  icon: "pencil-outline" as const,
                  onPress: () => {
                    model.setActionsClipId(null);
                    model.beginEditingClip(model.actionsClip!);
                  },
                },
                {
                  key: "add-notes",
                  label: model.actionsClip.notes?.trim() ? "Edit notes" : "Add notes",
                  icon: "document-text-outline" as const,
                  onPress: () => {
                    model.setActionsClipId(null);
                    model.setEditingClipDraft(model.actionsClip!.title);
                    model.setEditingClipNotesDraft(model.actionsClip!.notes || "");
                    model.setNotesSheetClipId(model.actionsClip!.id);
                  },
                },
                {
                  key: "delete",
                  label: "Delete",
                  icon: "trash-outline" as const,
                  destructive: true,
                  onPress: () => {
                    model.setActionsClipId(null);
                    AppAlert.destructive("Delete clip?", "This cannot be undone.", () => {
                      model.deleteClip(model.actionsClip!.id);
                    });
                  },
                },
              ]
            : []
        }
      />

      <ClipNotesSheet
        visible={!!model.notesSheetClip}
        clipSubtitle={
          model.notesSheetClip
            ? `${model.notesSheetClip.durationMs ? fmtDuration(model.notesSheetClip.durationMs) : "0:00"} · ${formatDate(model.notesSheetClip.createdAt)}`
            : ""
        }
        clip={model.notesSheetClip}
        idea={model.idea}
        globalCustomTags={model.clipCardContext.playback.globalCustomTags}
        titleDraft={model.editingClipDraft}
        notesDraft={model.editingClipNotesDraft}
        onChangeTitle={model.setEditingClipDraft}
        onChangeNotes={model.setEditingClipNotesDraft}
        onSave={model.saveNotesSheet}
        onCancel={() => model.setNotesSheetClipId(null)}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
