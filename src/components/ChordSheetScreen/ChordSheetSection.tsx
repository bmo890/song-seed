import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../styles";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import { MAX_CHORDS_PER_BAR } from "../../chordSheet";
import type { ChordSheetMeasure, ChordSheetSection as Section } from "../../types";

type Props = {
  section: Section;
  editable: boolean;
  selectionActive: boolean;
  selectedMeasureIds: string[];
  onTapMeasure: (measureId: string) => void;
  onLongPressMeasure: (measureId: string) => void;
  onAddMeasure: () => void;
  onRemoveChord: (measureId: string, index: number) => void;
  onNotes: (notes: string) => void;
  onOpenMenu: () => void;
};

const BAR_WIDTH = 76;
const BARLINE = colors.borderMuted;

type Cell = { kind: "bar"; measure: ChordSheetMeasure } | { kind: "add" };

function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) return items.length ? [items] : [];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function ChordSheetSection({
  section,
  editable,
  selectionActive,
  selectedMeasureIds,
  onTapMeasure,
  onLongPressMeasure,
  onAddMeasure,
  onRemoveChord,
  onNotes,
  onOpenMenu,
}: Props) {
  const [barsPerRow, setBarsPerRow] = useState(4);
  const selectedSet = new Set(selectedMeasureIds);

  const onStaffLayout = (e: LayoutChangeEvent) => {
    const next = Math.max(1, Math.floor(e.nativeEvent.layout.width / BAR_WIDTH));
    setBarsPerRow((prev) => (prev === next ? prev : next));
  };

  const cells: Cell[] = [
    ...section.measures.map((measure) => ({ kind: "bar" as const, measure })),
    ...(editable && !selectionActive ? [{ kind: "add" as const }] : []),
  ];
  const rows = chunk(cells, barsPerRow);

  return (
    <View style={styles.section}>
      {editable ? (
        <View style={styles.headerRow}>
          <Text style={styles.label}>{section.label || "Section"}</Text>
          <TextInput
            style={styles.noteInlineInput}
            value={section.notes}
            onChangeText={onNotes}
            placeholder="note…"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Pressable
            onPress={onOpenMenu}
            onLongPress={onOpenMenu}
            delayLongPress={300}
            hitSlop={8}
            style={({ pressed }) => (pressed ? appStyles.pressDown : null)}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.headerRow}>
          <Text style={styles.label}>{section.label}</Text>
          {section.notes.trim() ? (
            <Text style={styles.noteInline} numberOfLines={2}>
              {section.notes.trim()}
            </Text>
          ) : null}
        </View>
      )}

      {/* The staff: fixed-width bars divided by barlines, wrapped into clean rows
       * each closed by a final barline — like a page of staff paper. */}
      <View onLayout={onStaffLayout}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.staffRow}>
            {row.map((cell, cellIndex) =>
              cell.kind === "add" ? (
                <Pressable
                  key={`add-${cellIndex}`}
                  style={({ pressed }) => [styles.bar, styles.addBar, pressed ? appStyles.pressDown : null]}
                  onPress={onAddMeasure}
                >
                  <Ionicons name="add" size={16} color={colors.primary} />
                </Pressable>
              ) : (
                <Bar
                  key={cell.measure.id}
                  measure={cell.measure}
                  editable={editable}
                  selectionActive={selectionActive}
                  selected={selectedSet.has(cell.measure.id)}
                  onTap={() => onTapMeasure(cell.measure.id)}
                  onLongPress={() => onLongPressMeasure(cell.measure.id)}
                  onRemoveChord={(index) => onRemoveChord(cell.measure.id, index)}
                />
              )
            )}
            <View style={styles.closingLine} />
          </View>
        ))}
      </View>
    </View>
  );
}

function Bar({
  measure,
  editable,
  selectionActive,
  selected,
  onTap,
  onLongPress,
  onRemoveChord,
}: {
  measure: ChordSheetMeasure;
  editable: boolean;
  selectionActive: boolean;
  selected: boolean;
  onTap: () => void;
  onLongPress: () => void;
  onRemoveChord: (index: number) => void;
}) {
  const chords = measure.chords;
  // Individual chords are tappable-to-remove only when editing and NOT selecting
  // bars — in selection mode the whole bar toggles instead.
  const chordsRemovable = editable && !selectionActive;

  return (
    <Pressable
      style={[styles.bar, selected ? styles.barSelected : null]}
      onPress={editable ? onTap : undefined}
      onLongPress={editable ? onLongPress : undefined}
      delayLongPress={300}
      disabled={!editable}
    >
      <View style={styles.barChords}>
        {chords.length > 0 ? (
          chords.map((chord, index) =>
            chordsRemovable ? (
              <Pressable key={index} onPress={() => onRemoveChord(index)} hitSlop={2}>
                <Text style={styles.chord}>{chord}</Text>
              </Pressable>
            ) : (
              <Text key={index} style={styles.chord}>
                {chord}
              </Text>
            )
          )
        ) : editable && !selectionActive ? (
          <Ionicons name="add" size={13} color={colors.borderMuted} />
        ) : (
          <Text style={styles.rest}>{"—"}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  label: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.primary,
  },
  noteInline: {
    ...textTokens.supporting,
    fontStyle: "italic",
    flex: 1,
  },
  noteInlineInput: {
    ...textTokens.supporting,
    fontStyle: "italic",
    flex: 1,
    paddingVertical: 2,
    maxHeight: 44,
  },
  staffRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 8,
  },
  bar: {
    width: BAR_WIDTH,
    minHeight: 38,
    paddingHorizontal: 6,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: BARLINE,
  },
  barSelected: {
    backgroundColor: colors.surfaceHigh,
    borderLeftColor: colors.primary,
  },
  addBar: {
    width: BAR_WIDTH,
  },
  barChords: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    columnGap: spacing.sm,
    rowGap: 2,
  },
  closingLine: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: BARLINE,
  },
  chord: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: colors.textPrimary,
  },
  rest: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.borderMuted,
  },
});
