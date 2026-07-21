import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { clipLineageStyles, styles } from "../styles";
import { fmtDuration, formatDate } from "../../../utils";
import { ClipActionsSheet } from "../../modals/ClipActionsSheet";
import { ClipNotesSheet } from "../../modals/ClipNotesSheet";
import { AppAlert } from "../../common/AppAlert";
import { ClipTagPicker } from "../../IdeaDetailScreen/components/ClipTagPicker";
import { useClipLineageScreenModel } from "../hooks/useClipLineageScreenModel";
import { ClipLineageHeader } from "./ClipLineageHeader";
import { ClipLineageSortToggle } from "./ClipLineageSortToggle";
import { ClipLineageList } from "./ClipLineageList";

export function ClipLineageScreenContent() {
  const { t } = useTranslation();
  const model = useClipLineageScreenModel();

  if (!model.idea || !model.lineage || !model.clipCardContext) {
    return (
      <SafeAreaView style={[styles.screen, styles.screenProjectDetail]}>
        <View style={clipLineageStyles.emptyState}>
          <Text style={styles.emptyText}>{t("clipLineage.notFound")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, styles.screenProjectDetail]}>
      <ClipLineageHeader
        title={model.lineageTitle}
        subtitle={`${t("brand.take", { count: model.clipCount })} · ${model.idea.title}`}
        onBack={model.goBack}
      />
      <ClipLineageSortToggle direction={model.direction} onToggle={model.toggleDirection} />
      <ClipLineageList
        clipEntries={model.clipEntries}
        clipCardContext={model.clipCardContext}
        bottomPadding={24 + Math.max(model.insets.bottom, 16)}
      />

      <ClipActionsSheet
        visible={!!model.actionsClip}
        title={model.actionsClip?.title ?? t("clipLineage.actions")}
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
                  label: t("clipLineage.recordVariation"),
                  icon: "mic-outline" as const,
                  onPress: () => {
                    void model.openRecordingVariation(model.actionsClip!);
                  },
                },
                {
                  key: "rename",
                  label: t("clipLineage.rename"),
                  icon: "pencil-outline" as const,
                  onPress: () => {
                    model.setActionsClipId(null);
                    model.beginEditingClip(model.actionsClip!);
                  },
                },
                {
                  key: "add-notes",
                  label: model.actionsClip.notes?.trim() ? t("clipLineage.editNotes") : t("clipLineage.addNotes"),
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
                  label: t("common.delete"),
                  icon: "trash-outline" as const,
                  destructive: true,
                  onPress: () => {
                    model.setActionsClipId(null);
                    AppAlert.destructive(t("clipLineage.deleteClip"), t("clipLineage.cannotUndo"), () => {
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
        titleDraft={model.editingClipDraft}
        notesDraft={model.editingClipNotesDraft}
        onChangeTitle={model.setEditingClipDraft}
        onChangeNotes={model.setEditingClipNotesDraft}
        onSave={model.saveNotesSheet}
        onCancel={() => model.setNotesSheetClipId(null)}
      />
      <ClipTagPicker
        visible={!!model.tagPickerClip}
        clips={model.tagPickerClip ? [model.tagPickerClip] : []}
        idea={model.idea}
        globalCustomTags={model.clipCardContext.playback.globalCustomTags}
        onClose={() => model.setTagPickerClipId(null)}
      />

    </SafeAreaView>
  );
}
