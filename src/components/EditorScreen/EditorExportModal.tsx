import React from "react";
import { colors, radii } from "../../design/tokens";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Button } from "../common/Button";
import { MiniProgress } from "../MiniProgress";
import { TitleInput } from "../common/TitleInput";
import { styles } from "../../styles";
import { EditableSelection, formatSelectionDuration } from "./helpers";

type EditorExportModalProps = {
  visible: boolean;
  targetIdeaKind: "project" | "clip" | null;
  targetIdeaTitle: string | null;
  exportOperation: "extract" | "splice";
  keepRegions: EditableSelection[];
  removeRegions: EditableSelection[];
  extractNameDrafts: Record<string, string>;
  previewRegionId: string | null;
  isPreviewPlaying: boolean;
  playheadTimeMs: number;
  spliceNameDraft: string;
  suggestedExportTitle: string;
  removeOriginalAfterExport: boolean;
  onClose: () => void;
  onSelectExportOperation: (operation: "extract" | "splice") => void;
  onChangeExtractNameDraft: (regionId: string, value: string) => void;
  onToggleRegionPreview: (region: EditableSelection) => void;
  onBeginRegionPreviewScrub: (region: EditableSelection) => void;
  onSeekRegionPreview: (region: EditableSelection, relativeTimeMs: number) => void;
  onCancelRegionPreviewScrub: () => void;
  onChangeSpliceNameDraft: (value: string) => void;
  onToggleRemoveOriginalAfterExport: () => void;
  onSave: () => void;
  buildSuggestedTitle: (offset?: number) => string;
};

export function EditorExportModal({
  visible,
  targetIdeaKind,
  targetIdeaTitle,
  exportOperation,
  keepRegions,
  removeRegions,
  extractNameDrafts,
  previewRegionId,
  isPreviewPlaying,
  playheadTimeMs,
  spliceNameDraft,
  suggestedExportTitle,
  removeOriginalAfterExport,
  onClose,
  onSelectExportOperation,
  onChangeExtractNameDraft,
  onToggleRegionPreview,
  onBeginRegionPreviewScrub,
  onSeekRegionPreview,
  onCancelRegionPreviewScrub,
  onChangeSpliceNameDraft,
  onToggleRemoveOriginalAfterExport,
  onSave,
  buildSuggestedTitle,
}: EditorExportModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, exportModalStyles.modalCard]}>
          <Text style={styles.title}>Export Clips</Text>
          <Text style={[styles.cardMeta, { marginBottom: 2 }]}>
            {targetIdeaKind === "project"
              ? `Save new clip versions back into ${targetIdeaTitle}.`
              : `Save extracted clips back into ${targetIdeaTitle ?? "this folder"} as new clip cards.`}
          </Text>

          {keepRegions.length > 0 && removeRegions.length > 0 ? (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <Pressable
                style={[
                  exportModalStyles.segmentButton,
                  exportOperation === "extract" ? exportModalStyles.segmentButtonActive : null,
                ]}
                onPress={() => onSelectExportOperation("extract")}
              >
                <Text
                  style={[
                    exportModalStyles.segmentText,
                    exportOperation === "extract" ? exportModalStyles.segmentTextActive : null,
                  ]}
                >
                  Extract {keepRegions.length}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  exportModalStyles.segmentButton,
                  exportOperation === "splice" ? exportModalStyles.segmentButtonActive : null,
                ]}
                onPress={() => onSelectExportOperation("splice")}
              >
                <Text
                  style={[
                    exportModalStyles.segmentText,
                    exportOperation === "splice" ? exportModalStyles.segmentTextActive : null,
                  ]}
                >
                  Splice 1
                </Text>
              </Pressable>
            </View>
          ) : null}

          {exportOperation === "extract" ? (
            <>
              <Text style={[styles.cardMeta, { marginBottom: 2 }]}>
                Leave a name blank to use its suggested version title automatically.
              </Text>
              <ScrollView
                style={exportModalStyles.extractList}
                contentContainerStyle={exportModalStyles.extractListContent}
                showsVerticalScrollIndicator={false}
              >
                {keepRegions.map((region, index) => {
                  const draftValue = extractNameDrafts[region.id] ?? "";
                  const previewActive = previewRegionId === region.id;
                  const previewCurrentMs = previewActive
                    ? Math.max(0, Math.min(region.end - region.start, playheadTimeMs - region.start))
                    : 0;

                  return (
                    <View key={region.id} style={exportModalStyles.extractCard}>
                      <View style={exportModalStyles.extractCardTop}>
                        <Text style={exportModalStyles.extractCardTitle}>Clip {index + 1}</Text>
                        <Text style={exportModalStyles.extractCardDuration}>
                          {formatSelectionDuration(region.end - region.start)}
                        </Text>
                      </View>

                      <View style={exportModalStyles.extractPreviewRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.inlinePlayBtn,
                            exportModalStyles.extractPlayButton,
                            pressed ? styles.pressDownStrong : null,
                          ]}
                          onPress={() => onToggleRegionPreview(region)}
                        >
                          <Ionicons
                            name={previewActive && isPreviewPlaying ? "pause" : "play"}
                            size={14}
                            color={colors.textPrimary}
                          />
                        </Pressable>
                        <View style={[styles.inlinePlayerWrap, exportModalStyles.extractMiniWrap]}>
                          <MiniProgress
                            currentMs={previewCurrentMs}
                            durationMs={region.end - region.start}
                            onSeekStart={() => onBeginRegionPreviewScrub(region)}
                            onSeek={(relativeTimeMs) => onSeekRegionPreview(region, relativeTimeMs)}
                            onSeekCancel={onCancelRegionPreviewScrub}
                          />
                        </View>
                      </View>

                      <TitleInput
                        value={draftValue}
                        onChangeText={(value) => onChangeExtractNameDraft(region.id, value)}
                        placeholder={buildSuggestedTitle(index)}
                        containerStyle={{ marginTop: 12 }}
                      />
                    </View>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <>
              <Text style={[styles.cardMeta, { marginBottom: 6 }]}>Trimmed clip name</Text>
              <TitleInput
                value={spliceNameDraft}
                onChangeText={onChangeSpliceNameDraft}
                placeholder={suggestedExportTitle}
              />
              <Text style={[styles.cardMeta, { marginTop: 8 }]}>
                Leave empty to use the next auto-generated version name.
              </Text>
            </>
          )}

          <Pressable
            style={{ flexDirection: "row", alignItems: "center", marginTop: 16 }}
            onPress={onToggleRemoveOriginalAfterExport}
          >
            <Feather
              name={removeOriginalAfterExport ? "check-square" : "square"}
              size={18}
              color={removeOriginalAfterExport ? colors.primary : colors.textMuted}
            />
            <Text style={{ marginLeft: 8, fontSize: 14, color: colors.textSecondary }}>
              Delete the original full recording after export
            </Text>
          </Pressable>

          <Text style={[styles.cardMeta, { marginTop: 12 }]}>
            {removeOriginalAfterExport
              ? targetIdeaKind === "project"
                ? "The original source version will be removed and the new clips stay in this song."
                : "The original clip card will be removed and the new extracted clips stay in this ideas list."
              : targetIdeaKind === "project"
                ? "The source version stays in place and the exports are added as new versions."
                : "The source clip stays in place and the extracted clips are added as new cards."}
          </Text>

          <View style={[styles.rowButtons, { justifyContent: "flex-end", marginTop: 16 }]}>
            <Button variant="secondary" label="Cancel" onPress={onClose} />
            <Button label={exportOperation === "extract" ? "Extract" : "Save Splice"} onPress={onSave} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const exportModalStyles = StyleSheet.create({
  modalCard: {
    maxHeight: "86%",
    width: "92%",
  },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  segmentButtonActive: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.primary,
  },
  segmentText: {
    color: colors.textSecondary,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  segmentTextActive: {
    color: colors.primary,
  },
  extractList: {
    maxHeight: 360,
  },
  extractListContent: {
    gap: 12,
    paddingBottom: 4,
  },
  extractCard: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.xl,
    padding: 14,
    backgroundColor: colors.surface,
  },
  extractCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  extractCardTitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textPrimary,
  },
  extractCardDuration: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  extractPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  extractPlayButton: {
    marginTop: 0,
  },
  extractMiniWrap: {
    flex: 1,
  },
});
