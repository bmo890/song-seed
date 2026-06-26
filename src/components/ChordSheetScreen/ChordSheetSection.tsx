import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../styles";
import { colors, spacing, text as textTokens } from "../../design/tokens";
import { MAX_CHORDS_PER_BAR } from "../../chordSheet";
import type { ChordSheetMeasure, ChordSheetSection as Section } from "../../types";

type Props = {
  section: Section;
  editable: boolean;
  onTapMeasure: (measureId: string) => void;
  onAddMeasure: () => void;
  onRemoveChord: (measureId: string, index: number) => void;
  onRemoveMeasure: (measureId: string) => void;
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
  onTapMeasure,
  onAddMeasure,
  onRemoveChord,
  onRemoveMeasure,
  onNotes,
  onOpenMenu,
}: Props) {
  const [barsPerRow, setBarsPerRow] = useState(4);

  const onStaffLayout = (e: LayoutChangeEvent) => {
    const next = Math.max(1, Math.floor(e.nativeEvent.layout.width / BAR_WIDTH));
    setBarsPerRow((prev) => (prev === next ? prev : next));
  };

  const cells: Cell[] = [
    ...section.measures.map((measure) => ({ kind: "bar" as const, measure })),
    ...(editable ? [{ kind: "add" as const }] : []),
  ];
  const rows = chunk(cells, barsPerRow);

  return (
    <View style={styles.section}>
      {editable ? (
        <Pressable
          style={({ pressed }) => [styles.headerRow, pressed ? appStyles.pressDown : null]}
          onPress={onOpenMenu}
          onLongPress={onOpenMenu}
          delayLongPress={300}
        >
          <Text style={styles.label}>{section.label || "Section"}</Text>
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
        </Pressable>
      ) : (
        <Text style={styles.label}>{section.label}</Text>
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
                  onAddChord={() => onTapMeasure(cell.measure.id)}
                  onRemoveChord={(index) => onRemoveChord(cell.measure.id, index)}
                  onRemoveBar={() => onRemoveMeasure(cell.measure.id)}
                />
              )
            )}
            <View style={styles.closingLine} />
          </View>
        ))}
      </View>

      {editable ? (
        <TextInput
          style={styles.noteInput}
          value={section.notes}
          onChangeText={onNotes}
          placeholder="Add a note…"
          placeholderTextColor={colors.textMuted}
          multiline
        />
      ) : section.notes.trim() ? (
        <Text style={styles.note}>{section.notes.trim()}</Text>
      ) : null}
    </View>
  );
}

function Bar({
  measure,
  editable,
  onAddChord,
  onRemoveChord,
  onRemoveBar,
}: {
  measure: ChordSheetMeasure;
  editable: boolean;
  onAddChord: () => void;
  onRemoveChord: (index: number) => void;
  onRemoveBar: () => void;
}) {
  const chords = measure.chords;
  const isFull = chords.length >= MAX_CHORDS_PER_BAR;

  return (
    <Pressable
      style={styles.bar}
      onPress={editable && !isFull ? onAddChord : undefined}
      disabled={!editable}
    >
      {editable ? (
        <Pressable style={styles.barDelete} onPress={onRemoveBar} hitSlop={6}>
          <Ionicons name="close" size={11} color={colors.textSecondary} />
        </Pressable>
      ) : null}

      <View style={styles.barChords}>
        {chords.length > 0 ? (
          chords.map((chord, index) =>
            editable ? (
              <Pressable key={index} onPress={() => onRemoveChord(index)} hitSlop={2}>
                <Text style={styles.chord}>{chord}</Text>
              </Pressable>
            ) : (
              <Text key={index} style={styles.chord}>
                {chord}
              </Text>
            )
          )
        ) : editable ? (
          <Ionicons name="add" size={13} color={colors.borderMuted} />
        ) : (
          <Text style={styles.rest}>{"—"}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginBottom: spacing.xs,
  },
  label: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  staffRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 12,
  },
  bar: {
    width: BAR_WIDTH,
    minHeight: 40,
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: BARLINE,
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
  barDelete: {
    position: "absolute",
    top: 0,
    right: 2,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
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
  note: {
    ...textTokens.supporting,
    fontStyle: "italic",
    marginTop: spacing.sm,
  },
  noteInput: {
    ...textTokens.supporting,
    fontStyle: "italic",
    marginTop: spacing.sm,
    paddingVertical: 4,
  },
});
