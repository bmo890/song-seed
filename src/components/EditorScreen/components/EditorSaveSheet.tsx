import React from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text } from "../../../design/tokens";
import { BottomSheet } from "../../common/BottomSheet";
import { Button } from "../../common/Button";
import { TitleInput } from "../../common/TitleInput";
import { fmtDuration } from "../../../utils";
import { UserText } from "../../../i18n";
import { CUT_COLOR, KEEP_COLOR, type EditableSelection } from "../helpers";
import { useTranslation } from "react-i18next";

type EditorSaveSheetProps = {
  visible: boolean;
  operation: "extract" | "splice";
  targetIdeaKind: "project" | "clip" | null;
  keepRegions: EditableSelection[];
  removedMs: number;
  /** "Grid kept" / "Grid kept to 01:12" / "No grid" — null when the clip has no grid. */
  gridOutcomeLine: string | null;
  spliceNameDraft: string;
  suggestedExportTitle: string;
  suggestedTitleFor: (index: number) => string;
  removeOriginalAfterExport: boolean;
  confirmLabel: string;
  onChangeSpliceNameDraft: (value: string) => void;
  onToggleRemoveOriginalAfterExport: () => void;
  onClose: () => void;
  onSave: () => void;
};

/**
 * The commit step — a receipt, not a form.
 *
 * Extracted parts were already named on their rows while the musician worked, so this
 * only has to show what is about to be made and take one press. The single genuinely
 * dangerous option lives here rather than on the page, in the danger tier it deserves.
 */
export function EditorSaveSheet({
  visible,
  operation,
  targetIdeaKind,
  keepRegions,
  removedMs,
  gridOutcomeLine,
  spliceNameDraft,
  suggestedExportTitle,
  suggestedTitleFor,
  removeOriginalAfterExport,
  confirmLabel,
  onChangeSpliceNameDraft,
  onToggleRemoveOriginalAfterExport,
  onClose,
  onSave,
}: EditorSaveSheetProps) {
  const { t } = useTranslation();
  const ordered = [...keepRegions].sort((a, b) => a.start - b.start);

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAvoiding dismissDistance={360}>
      <View style={s.content}>
        <Text style={s.title}>{confirmLabel}</Text>

        {operation === "extract" ? (
          <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
            {ordered.map((region, index) => {
              const named = !!region.title?.trim();
              return (
                <View key={region.id} style={s.row}>
                  <View style={[s.dot, { backgroundColor: KEEP_COLOR }]}>
                    <Text style={s.dotText}>{index + 1}</Text>
                  </View>
                  <UserText style={[s.name, named ? s.nameGiven : null]} numberOfLines={1}>
                    {region.title?.trim() || suggestedTitleFor(index)}
                  </UserText>
                  <Text style={s.duration}>{fmtDuration(region.end - region.start)}</Text>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={s.spliceBlock}>
            <View style={s.row}>
              <View style={[s.dot, { backgroundColor: CUT_COLOR }]}>
                <Ionicons name="cut-outline" size={11} color={colors.onDanger} />
              </View>
              <Text style={s.name}>{t("editor.removedSummary", { duration: fmtDuration(removedMs) })}</Text>
            </View>
            <TitleInput
              value={spliceNameDraft}
              onChangeText={onChangeSpliceNameDraft}
              placeholder={suggestedExportTitle}
            />
          </View>
        )}

        {gridOutcomeLine ? (
          <View style={s.gridRow}>
            <Ionicons name="grid-outline" size={13} color={colors.textMuted} />
            <Text style={s.gridText}>{gridOutcomeLine}</Text>
          </View>
        ) : null}

        <View style={[s.dangerRow, removeOriginalAfterExport ? s.dangerRowArmed : null]}>
          <View style={s.dangerCopy}>
            <Text style={s.dangerLabel}>{t("editor.deleteOriginal")}</Text>
            {removeOriginalAfterExport ? (
              <Text style={s.dangerHint}>
                {targetIdeaKind === "project" ? t("editor.replaceTakeHint") : t("editor.replaceClipHint")}
              </Text>
            ) : null}
          </View>
          <Switch
            value={removeOriginalAfterExport}
            onValueChange={onToggleRemoveOriginalAfterExport}
            trackColor={{ false: colors.surfaceHigh, true: colors.danger }}
            thumbColor={colors.surface}
            accessibilityLabel={t("editor.deleteOriginal")}
          />
        </View>

        <View style={s.actions}>
          <Button variant="secondary" label={t("common.cancel")} onPress={onClose} />
          <Button
            variant={removeOriginalAfterExport ? "destructive" : "primary-emphasis"}
            label={confirmLabel}
            onPress={onSave}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, gap: spacing.md },
  title: { ...text.headerTitle },
  list: { maxHeight: 240 },
  listContent: { gap: 2 },
  spliceBlock: { gap: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  dotText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: colors.onPrimary,
  },
  /** A name the musician gave earns the serif; a suggested one stays quiet. */
  name: { ...text.supporting, flex: 1, color: colors.textSecondary },
  nameGiven: { fontFamily: "Lora_500Medium", fontSize: 15, color: colors.textPrimary },
  duration: { ...text.caption, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  gridRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  gridText: { ...text.caption, color: colors.textMuted },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
  },
  dangerRowArmed: { backgroundColor: colors.dangerSurface },
  dangerCopy: { flex: 1, gap: 2 },
  dangerLabel: { ...text.body, fontFamily: "PlusJakartaSans_600SemiBold", color: colors.danger },
  dangerHint: { ...text.supporting, fontSize: 12, color: colors.textSecondary },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
});
