import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Switch } from "../../common/Switch";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text } from "../../../design/tokens";
import { BottomSheet } from "../../common/BottomSheet";
import { Button } from "../../common/Button";
import { Spinner } from "../../common/Spinner";
import { TitleInput } from "../../common/TitleInput";
import { fmtDuration } from "../../../utils";
import { UserText } from "../../../i18n";
import { KEEP_COLOR, type EditableSelection } from "../helpers";
import { useTranslation } from "react-i18next";

type EditorSaveSheetProps = {
  visible: boolean;
  operation: "extract" | "splice" | "transform";
  /** One-line summary of a transform ("0.85x · −2 semitones"). */
  summaryLine?: string;
  /** The clip being edited, named in the sheet's second line. */
  sourceTitle: string;
  targetIdeaKind: "project" | "clip" | null;
  keepRegions: EditableSelection[];
  removedMs: number;
  /** "Grid kept" / "Grid kept to 01:12" / "No grid" — null when the clip has no grid. */
  gridOutcomeLine: string | null;
  spliceNameDraft: string;
  suggestedExportTitle: string;
  suggestedTitleFor: (index: number) => string;
  removeOriginalAfterExport: boolean;
  /** While the file renders, the key itself says so (no dialog over the sheet). */
  saving: boolean;
  onChangeSpliceNameDraft: (value: string) => void;
  onToggleRemoveOriginalAfterExport: () => void;
  onClose: () => void;
  onSave: () => void;
};

/**
 * The commit step: a receipt in rows on paper (2026-10-16), one key.
 *
 * What is about to be made, numbered in the parts' ink; the one dangerous option
 * as a plain row with its switch; then Save, which turns to a red "Replace" when
 * the original goes too. No Cancel: the sheet drags away. While saving, the key
 * carries the spinner in place of the old centred card.
 */
export function EditorSaveSheet({
  visible,
  operation,
  summaryLine,
  sourceTitle,
  targetIdeaKind,
  keepRegions,
  removedMs,
  gridOutcomeLine,
  spliceNameDraft,
  suggestedExportTitle,
  suggestedTitleFor,
  removeOriginalAfterExport,
  saving,
  onChangeSpliceNameDraft,
  onToggleRemoveOriginalAfterExport,
  onClose,
  onSave,
}: EditorSaveSheetProps) {
  const { t } = useTranslation();
  const ordered = [...keepRegions].sort((a, b) => a.start - b.start);
  const title =
    operation === "extract" ? t("editor.saveClipsTitle", { count: ordered.length }) : t("editor.saveCopyTitle");
  const subtitle =
    operation === "extract"
      ? t("editor.fromSource", { title: sourceTitle })
      : operation === "splice"
        ? t("editor.removedFrom", { duration: fmtDuration(removedMs), title: sourceTitle })
        : summaryLine ?? "";

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAvoiding dismissDistance={360}>
      <View style={s.content}>
        <View>
          <Text style={s.title}>{title}</Text>
          {subtitle ? (
            <Text style={s.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View>
          {operation === "extract" ? (
            <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
              {ordered.map((region, index) => {
                const named = !!region.title?.trim();
                return (
                  <View key={region.id} style={s.row}>
                    <Text style={s.numeral}>{index + 1}</Text>
                    <UserText style={[s.name, named ? s.nameGiven : null]} numberOfLines={1}>
                      {region.title?.trim() || suggestedTitleFor(index)}
                    </UserText>
                    <Text style={s.duration}>{fmtDuration(region.end - region.start)}</Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={s.field}>
              <TitleInput
                value={spliceNameDraft}
                onChangeText={onChangeSpliceNameDraft}
                placeholder={suggestedExportTitle}
              />
            </View>
          )}

          <View style={[s.row, s.dangerRow]}>
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
              tone="danger"
              accessibilityLabel={t("editor.deleteOriginal")}
            />
          </View>
        </View>

        {gridOutcomeLine ? (
          <View style={s.gridRow}>
            <Ionicons name="grid-outline" size={13} color={colors.textMuted} />
            <Text style={s.gridText}>{gridOutcomeLine}</Text>
          </View>
        ) : null}

        {saving ? (
          <View style={s.savingKey} accessibilityRole="progressbar" accessibilityLabel={t("editor.saving")}>
            <Spinner size="small" color={colors.primaryDeep} />
            <Text style={s.savingText}>{t("editor.saving")}</Text>
          </View>
        ) : (
          <Button
            variant={removeOriginalAfterExport ? "destructive-soft" : "primary"}
            label={removeOriginalAfterExport ? t("editor.replace") : t("common.save")}
            onPress={onSave}
          />
        )}
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, gap: spacing.lg },
  title: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
  subtitle: {
    ...text.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  list: {
    maxHeight: 240,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  numeral: {
    width: 18,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
    color: KEEP_COLOR,
    fontVariant: ["tabular-nums"],
  },
  /** A name the musician gave earns the serif; a suggested one stays quiet. */
  name: {
    flex: 1,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  nameGiven: { ...text.cardTitle, fontSize: 16, lineHeight: 21 },
  duration: {
    ...text.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  field: { paddingBottom: spacing.sm },
  dangerRow: { minHeight: 56 },
  dangerCopy: { flex: 1, gap: 2 },
  dangerLabel: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.danger,
  },
  dangerHint: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  gridRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  gridText: {
    ...text.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textMuted,
  },
  savingKey: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
  },
  savingText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
});
