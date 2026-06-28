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
  onRemoveChord: (measureId: string, index: number) => void;
  onNotes: (notes: string) => void;
  onOpenMenu: () => void;
};

const BARLINE = colors.borderMuted;
// Four bars to a line — the standard chart convention. Bars are a quarter of the
// width each so a full line always fits and fills the row evenly (no fixed width
// that leaves a gap on the right).
const BARS_PER_ROW = 4;

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
  const selectedSet = new Set(selectedMeasureIds);
  const noteField = useScrollIntoViewOnFocus();

  const rows = chunk(section.measures, BARS_PER_ROW);
  const showAdd = editable && !selectionActive;

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
            {row.map((measure, i) => (
              <Bar
                key={measure.id}
                measure={measure}
                isLast={i === row.length - 1}
                editable={editable}
                selectionActive={selectionActive}
                selected={selectedSet.has(measure.id)}
                onTap={() => onTapMeasure(measure.id)}
                onLongPress={() => onLongPressMeasure(measure.id)}
                onRemoveChord={(index) => onRemoveChord(measure.id, index)}
              />
            ))}
          </View>
        ))}
        {showAdd ? (
          <View style={styles.addRow}>
            <AddBarButton onPress={onAddMeasure} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Bar({
  measure,
  isLast,
  editable,
  selectionActive,
  selected,
  onTap,
  onLongPress,
  onRemoveChord,
}: {
  measure: ChordSheetMeasure;
  isLast: boolean;
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
      style={[styles.bar, isLast ? styles.barLast : null, selected ? styles.barSelected : null]}
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
        ) : (
          <Text style={styles.rest}>{"—"}</Text>
        )}
      </View>
    </Pressable>
  );
}

/** Small filled "+" centered below the staff — adds a new bar to the section. */
function AddBarButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityLabel="Add bar"
      style={({ pressed }) => [styles.addCircle, pressed ? appStyles.pressDown : null]}
    >
      <Ionicons name="add" size={15} color={colors.onPrimary} />
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
  addRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 2,
    marginBottom: 4,
  },
  addCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  barChords: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 4,
    rowGap: 2,
  },
  chord: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  rest: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.borderMuted,
  },
});
