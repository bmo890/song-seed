import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { UserTextInput } from "../../../i18n/direction";
import { fmt, fmtDuration } from "../../../utils";
import { colors, radii, spacing, text } from "../../../design/tokens";
import { SurfaceCard } from "../../common/SurfaceCard";
import { IconButton } from "../../common/IconButton";
import { EmptyState } from "../../common/EmptyState";
import { CUT_COLOR, KEEP_COLOR, type EditableSelection } from "../helpers";
import { useTranslation } from "react-i18next";

type EditorSelectionListProps = {
  selectedRanges: EditableSelection[];
  intent: "keep" | "remove";
  selectedRangeId: string | null;
  /** Suggested name for the part at this index — shown as the field's placeholder. */
  suggestedTitleFor: (index: number) => string;
  /** Naming only applies where each part becomes its own clip. */
  showNames: boolean;
  onSelectRange: (range: EditableSelection) => void;
  onRenameRange: (id: string, title: string) => void;
  onRemoveRange: (id: string) => void;
};

/** The parts of the clip, in time order, as structural rows (`SurfaceCard`). Tapping
 * one selects it — which cues the playhead and opens the inspector beneath — so the
 * row itself is the control; the numbered dot carries the current keep/remove intent
 * and the canon selected outline says which part the inspector is holding. */
export function EditorSelectionList({
  selectedRanges,
  intent,
  selectedRangeId,
  suggestedTitleFor,
  showNames,
  onSelectRange,
  onRenameRange,
  onRemoveRange,
}: EditorSelectionListProps) {
  const { t } = useTranslation();
  if (selectedRanges.length === 0) {
    return <EmptyState compact title={t("editor.noPartsTitle")} body={t("editor.noPartsBody")} />;
  }

  const accent = intent === "keep" ? KEEP_COLOR : CUT_COLOR;
  const ordered = [...selectedRanges].sort((a, b) => a.start - b.start);

  return (
    <View style={s.wrap}>
      {ordered.map((range, index) => {
        const selected = range.id === selectedRangeId;
        return (
          <SurfaceCard
            key={range.id}
            style={s.row}
            selected={selected}
            onPress={() => onSelectRange(range)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <View style={[s.idx, { backgroundColor: accent }]}>
              <Text style={s.idxText}>{index + 1}</Text>
            </View>
            <View style={s.copy}>
              <View style={s.timeRow}>
                <Text style={s.times}>
                  {fmt(range.start)} – {fmt(range.end)}
                </Text>
                <Text style={s.dur}>{fmtDuration(range.end - range.start)}</Text>
              </View>
              {showNames ? (
                <UserTextInput
                  style={[s.nameInput, range.title ? s.nameInputFilled : null]}
                  value={range.title ?? ""}
                  onChangeText={(value) => onRenameRange(range.id, value)}
                  placeholder={suggestedTitleFor(index)}
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  accessibilityLabel={t("editor.partName")}
                />
              ) : null}
            </View>
            {/* Removing a part is destruction, so the glyph wears danger; the tick
                comes from IconButton (haptic `tap`, any acknowledged press). */}
            <IconButton
              icon="trash-outline"
              size={18}
              color={colors.danger}
              hitSlop={10}
              stopPropagation
              onPress={() => onRemoveRange(range.id)}
              accessibilityLabel={t("editor.deletePart")}
            />
          </SurfaceCard>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, gap: 6 },
  // Layout only — the shell (fill, radius, hairline, whisper shadow) is the card's.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  idx: {
    width: 20,
    height: 20,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  idxText: {
    ...text.caption,
    fontSize: 11,
    color: colors.onPrimary,
  },
  copy: { flex: 1, gap: 1 },
  timeRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  times: {
    ...text.body,
    fontVariant: ["tabular-nums"],
  },
  dur: {
    ...text.supporting,
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  /** Named parts earn the serif; an unnamed one shows its suggested name quietly, so a
   *  list of timestamps stays calm. */
  nameInput: {
    ...text.supporting,
    padding: 0,
    // Explicit height: a bare TextInput reports a taller intrinsic size than its text
    // and was pushing its own baseline past the row's rounded edge.
    height: 22,
    lineHeight: 16,
    fontSize: 12.5,
  },
  nameInputFilled: {
    ...text.cardTitle,
    height: 24,
    lineHeight: 18,
    fontSize: 14,
  },
});
