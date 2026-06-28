import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../styles";
import { colors, spacing, text as textTokens } from "../../design/tokens";
import { MAX_CHORDS_PER_BAR } from "../../chordSheet";
import { SelectionActionSheet } from "../common/SelectionActionSheet";
import type { SelectionAction } from "../common/SelectionDock";
import type { ChordSheetMeasure, ChordSheetSection as Section } from "../../types";

type Props = {
  section: Section;
  editable: boolean;
  onTapMeasure: (measureId: string) => void;
  onAddMeasure: () => void;
  onInsertMeasure: (atIndex: number) => void;
  onSplitMeasure: (measureId: string) => void;
  onRemoveChord: (measureId: string, index: number) => void;
  onRemoveMeasure: (measureId: string) => void;
  onClearMeasure: (measureId: string) => void;
  onNotes: (notes: string) => void;
  onOpenMenu: () => void;
};

const BAR_WIDTH = 76;
const BARLINE = colors.borderMuted;

type Cell = { kind: "bar"; measure: ChordSheetMeasure } | { kind: "add" };
type BarMenu = { measureId: string; index: number; chordCount: number };

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
  onInsertMeasure,
  onSplitMeasure,
  onRemoveChord,
  onRemoveMeasure,
  onClearMeasure,
  onNotes,
  onOpenMenu,
}: Props) {
  const [barsPerRow, setBarsPerRow] = useState(4);
  const [barMenu, setBarMenu] = useState<BarMenu | null>(null);

  const onStaffLayout = (e: LayoutChangeEvent) => {
    const next = Math.max(1, Math.floor(e.nativeEvent.layout.width / BAR_WIDTH));
    setBarsPerRow((prev) => (prev === next ? prev : next));
  };

  const cells: Cell[] = [
    ...section.measures.map((measure) => ({ kind: "bar" as const, measure })),
    ...(editable ? [{ kind: "add" as const }] : []),
  ];
  const rows = chunk(cells, barsPerRow);

  const barMenuActions: SelectionAction[] = barMenu
    ? [
        {
          key: "insert-before",
          label: "Insert bar before",
          icon: "arrow-back-outline",
          onPress: () => onInsertMeasure(barMenu.index),
        },
        {
          key: "insert-after",
          label: "Insert bar after",
          icon: "arrow-forward-outline",
          onPress: () => onInsertMeasure(barMenu.index + 1),
        },
        ...(barMenu.chordCount > 1
          ? [
              {
                key: "split",
                label: "Split into separate bars",
                icon: "git-branch-outline" as const,
                onPress: () => onSplitMeasure(barMenu.measureId),
              },
            ]
          : []),
        ...(barMenu.chordCount > 0
          ? [
              {
                key: "clear",
                label: "Clear bar",
                icon: "backspace-outline" as const,
                onPress: () => onClearMeasure(barMenu.measureId),
              },
            ]
          : []),
        {
          key: "delete",
          label: "Delete bar",
          icon: "trash-outline",
          tone: "danger",
          onPress: () => onRemoveMeasure(barMenu.measureId),
        },
      ]
    : [];

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
                  onAddChord={() => onTapMeasure(cell.measure.id)}
                  onRemoveChord={(index) => onRemoveChord(cell.measure.id, index)}
                  onRemoveBar={() => onRemoveMeasure(cell.measure.id)}
                  onOpenMenu={() =>
                    setBarMenu({
                      measureId: cell.measure.id,
                      index: section.measures.findIndex((m) => m.id === cell.measure.id),
                      chordCount: cell.measure.chords.length,
                    })
                  }
                />
              )
            )}
            <View style={styles.closingLine} />
          </View>
        ))}
      </View>

      <SelectionActionSheet
        visible={!!barMenu}
        title="Bar"
        actions={barMenuActions}
        onClose={() => setBarMenu(null)}
      />
    </View>
  );
}

function Bar({
  measure,
  editable,
  onAddChord,
  onRemoveChord,
  onRemoveBar,
  onOpenMenu,
}: {
  measure: ChordSheetMeasure;
  editable: boolean;
  onAddChord: () => void;
  onRemoveChord: (index: number) => void;
  onRemoveBar: () => void;
  onOpenMenu: () => void;
}) {
  const chords = measure.chords;
  const isFull = chords.length >= MAX_CHORDS_PER_BAR;

  return (
    <Pressable
      style={styles.bar}
      onPress={editable && !isFull ? onAddChord : undefined}
      onLongPress={editable ? onOpenMenu : undefined}
      delayLongPress={300}
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
});
