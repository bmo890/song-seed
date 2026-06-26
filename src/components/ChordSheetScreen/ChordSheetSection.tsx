import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  onRename: (label: string) => void;
  onNotes: (notes: string) => void;
  onMove: (dir: -1 | 1) => void;
  onRemoveSection: () => void;
};

export function ChordSheetSection({
  section,
  editable,
  onTapMeasure,
  onAddMeasure,
  onRemoveChord,
  onRemoveMeasure,
  onRename,
  onNotes,
  onMove,
  onRemoveSection,
}: Props) {
  return (
    <View style={styles.section}>
      {editable ? (
        <View style={styles.headerEdit}>
          <TextInput
            style={styles.labelInput}
            value={section.label}
            onChangeText={onRename}
            placeholder="SECTION"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />
          <GhostIcon icon="chevron-up" onPress={() => onMove(-1)} />
          <GhostIcon icon="chevron-down" onPress={() => onMove(1)} />
          <GhostIcon icon="trash-outline" onPress={onRemoveSection} />
        </View>
      ) : (
        <Text style={styles.label}>{section.label}</Text>
      )}

      {/* The staff: bars divided by thin barlines, flowing and wrapping freely. */}
      <View style={styles.staff}>
        {section.measures.map((measure) => (
          <Bar
            key={measure.id}
            measure={measure}
            editable={editable}
            onAddChord={() => onTapMeasure(measure.id)}
            onRemoveChord={(index) => onRemoveChord(measure.id, index)}
            onRemoveBar={() => onRemoveMeasure(measure.id)}
          />
        ))}

        {editable ? (
          <Pressable
            style={({ pressed }) => [styles.addBar, pressed ? appStyles.pressDown : null]}
            onPress={onAddMeasure}
            hitSlop={4}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
          </Pressable>
        ) : section.measures.length > 0 ? (
          <View style={styles.closingLine} />
        ) : null}
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

  if (!editable) {
    return (
      <View style={styles.bar}>
        {chords.length > 0 ? (
          chords.map((chord, index) => (
            <Text key={index} style={styles.chord}>
              {chord}
            </Text>
          ))
        ) : (
          <Text style={styles.rest}>{"—"}</Text>
        )}
      </View>
    );
  }

  return (
    <Pressable
      style={styles.bar}
      onPress={isFull ? undefined : onAddChord}
      onLongPress={onRemoveBar}
      delayLongPress={350}
    >
      {chords.length > 0 ? (
        chords.map((chord, index) => (
          <Pressable key={index} onPress={() => onRemoveChord(index)} hitSlop={3}>
            <Text style={styles.chord}>{chord}</Text>
          </Pressable>
        ))
      ) : (
        <Ionicons name="add" size={14} color={colors.borderMuted} />
      )}
    </Pressable>
  );
}

function GhostIcon({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.ghostIcon, pressed ? appStyles.pressDown : null]}
      onPress={onPress}
      hitSlop={6}
    >
      <Ionicons name={icon} size={15} color={colors.textMuted} />
    </Pressable>
  );
}

const BAR_MIN_WIDTH = 62;
const BAR_HEIGHT = 46;
const BARLINE = colors.borderMuted;

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  headerEdit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: spacing.xs,
  },
  labelInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.primary,
    paddingVertical: 4,
  },
  ghostIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  staff: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    rowGap: 12,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minWidth: BAR_MIN_WIDTH,
    minHeight: BAR_HEIGHT,
    paddingHorizontal: spacing.md,
    // The barline that opens each bar; bars sit flush so the lines read as a staff.
    borderLeftWidth: 1,
    borderLeftColor: BARLINE,
  },
  closingLine: {
    width: 1,
    minHeight: BAR_HEIGHT,
    backgroundColor: BARLINE,
  },
  addBar: {
    width: 44,
    minHeight: BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: BARLINE,
  },
  chord: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 17,
    color: colors.textPrimary,
  },
  rest: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
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
