import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../styles";
import { colors, spacing, text as textTokens } from "../../design/tokens";
import { useScrollIntoViewOnFocus } from "./components/chartScroll";
import type { ChordSheetMeasure, ChordSheetSection as Section } from "../../types";

type Props = {
  section: Section;
  editable: boolean;
  selectionActive: boolean;
  selectedMeasureIds: string[];
  onTapMeasure: (measureId: string) => void;
  onLongPressMeasure: (measureId: string) => void;
  onAddMeasure: () => void;
  onNotes: (notes: string) => void;
  onOpenMenu: () => void;
};

// A touch darker than borderMuted so the barlines read clearly on the page.
const BARLINE = "#BCA59B";
// Four bars to a line — the standard chart convention. Bars are a quarter of the
// width each so a full line always fits and fills the row evenly (no fixed width
// that leaves a gap on the right).
const BARS_PER_ROW = 4;

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
  onNotes,
  onOpenMenu,
}: Props) {
  const selectedSet = new Set(selectedMeasureIds);
  const noteField = useScrollIntoViewOnFocus();

  const showAdd = editable && !selectionActive;
  // The add affordance is a faint "ghost" bar that flows in the staff where the
  // next bar would go, rather than a separate button.
  const cells: Cell[] = [
    ...section.measures.map((measure) => ({ kind: "bar" as const, measure })),
    ...(showAdd ? [{ kind: "add" as const }] : []),
  ];
  const rows = chunk(cells, BARS_PER_ROW);

  return (
    <View style={styles.section}>
      {editable ? (
        <View style={styles.headerRow}>
          <Text style={styles.label}>{section.label || "Section"}</Text>
          <TextInput
            ref={noteField.ref}
            onFocus={noteField.onFocus}
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

      {/* The staff: quarter-width bars divided by barlines, four to a line, the
       * last bar of each line closed by its own right barline. */}
      <View>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.staffRow}>
            {row.map((cell, i) =>
              cell.kind === "add" ? (
                <GhostBar key="add" isLast={i === row.length - 1} onPress={onAddMeasure} />
              ) : (
                <Bar
                  key={cell.measure.id}
                  measure={cell.measure}
                  isLast={i === row.length - 1}
                  editable={editable}
                  selected={selectedSet.has(cell.measure.id)}
                  onTap={() => onTapMeasure(cell.measure.id)}
                  onLongPress={() => onLongPressMeasure(cell.measure.id)}
                />
              )
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function Bar({
  measure,
  isLast,
  editable,
  selected,
  onTap,
  onLongPress,
}: {
  measure: ChordSheetMeasure;
  isLast: boolean;
  editable: boolean;
  selected: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const chords = measure.chords;
  // A bar's chords render as one auto-shrinking line so they fit the cell instead
  // of being clipped — keeps every row the same height. Editing a bar's chords
  // happens in the bar editor (single-press), never by tapping chords on the staff.
  return (
    <Pressable
      style={[styles.bar, isLast ? styles.barLast : null, selected ? styles.barSelected : null]}
      onPress={editable ? onTap : undefined}
      onLongPress={editable ? onLongPress : undefined}
      delayLongPress={300}
      disabled={!editable}
    >
      {chords.length === 0 ? (
        <Text style={styles.rest}>{"—"}</Text>
      ) : (
        <Text style={[styles.chord, styles.chordFill]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {chords.join("  ")}
        </Text>
      )}
    </Pressable>
  );
}

/** A faint phantom bar in the next slot — tap to append a bar to the section. */
function GhostBar({ isLast, onPress }: { isLast: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Add bar"
      style={({ pressed }) => [styles.ghostBar, isLast ? styles.ghostBarLast : null, pressed ? appStyles.pressDown : null]}
    >
      <Ionicons name="add" size={16} color="#C2A99F" />
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
    width: "25%",
    minHeight: 38,
    paddingHorizontal: 4,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderLeftWidth: 1,
    borderLeftColor: BARLINE,
  },
  barLast: {
    borderRightWidth: 1,
    borderRightColor: BARLINE,
  },
  barSelected: {
    backgroundColor: colors.surfaceHigh,
    borderLeftColor: colors.primary,
  },
  ghostBar: {
    width: "25%",
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F0EA",
    borderLeftWidth: 1,
    borderLeftColor: "#E4D5CE",
  },
  ghostBarLast: {
    borderRightWidth: 1,
    borderRightColor: "#E4D5CE",
  },
  chordFill: { alignSelf: "stretch" },
  chord: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: "center",
  },
  rest: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.borderMuted,
  },
});
