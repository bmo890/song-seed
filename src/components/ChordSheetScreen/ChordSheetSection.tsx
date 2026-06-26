import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../styles";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import type { ChordSheetSection as Section } from "../../types";

type Props = {
  section: Section;
  editable: boolean;
  onTapMeasure: (measureId: string) => void;
  onClearMeasure: (measureId: string) => void;
  onAddMeasure: () => void;
  onRemoveLastMeasure: () => void;
  onRename: (label: string) => void;
  onNotes: (notes: string) => void;
  onMove: (dir: -1 | 1) => void;
  onRemoveSection: () => void;
};

export function ChordSheetSection({
  section,
  editable,
  onTapMeasure,
  onClearMeasure,
  onAddMeasure,
  onRemoveLastMeasure,
  onRename,
  onNotes,
  onMove,
  onRemoveSection,
}: Props) {
  return (
    <View style={styles.section}>
      {editable ? (
        <View style={styles.headerRowEdit}>
          <TextInput
            style={styles.labelInput}
            value={section.label}
            onChangeText={onRename}
            placeholder="Section"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={styles.iconBtn} onPress={() => onMove(-1)} hitSlop={6}>
            <Ionicons name="arrow-up" size={15} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => onMove(1)} hitSlop={6}>
            <Ionicons name="arrow-down" size={15} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={onRemoveSection} hitSlop={6}>
            <Ionicons name="trash-outline" size={15} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : (
        <Text style={styles.label}>{section.label}</Text>
      )}

      <View style={styles.bars}>
        {section.measures.map((measure) => {
          const content = measure.chords.join("  ");
          const inner = (
            <Text style={[styles.barText, !content ? styles.barTextEmpty : null]} numberOfLines={1}>
              {content || (editable ? "+" : "·")}
            </Text>
          );
          if (!editable) {
            return (
              <View key={measure.id} style={styles.bar}>
                {inner}
              </View>
            );
          }
          return (
            <Pressable
              key={measure.id}
              style={({ pressed }) => [styles.bar, styles.barEditable, pressed ? appStyles.pressDown : null]}
              onPress={() => onTapMeasure(measure.id)}
              onLongPress={() => onClearMeasure(measure.id)}
              delayLongPress={300}
            >
              {inner}
            </Pressable>
          );
        })}
      </View>

      {editable ? (
        <View style={styles.barControls}>
          <Pressable style={styles.barControlBtn} onPress={onAddMeasure} hitSlop={6}>
            <Ionicons name="add" size={14} color={colors.primary} />
            <Text style={styles.barControlText}>Bar</Text>
          </Pressable>
          {section.measures.length > 0 ? (
            <Pressable style={styles.barControlBtn} onPress={onRemoveLastMeasure} hitSlop={6}>
              <Ionicons name="remove" size={14} color={colors.textSecondary} />
              <Text style={[styles.barControlText, styles.barControlTextMuted]}>Bar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {editable ? (
        <TextInput
          style={styles.notesInput}
          value={section.notes}
          onChangeText={onNotes}
          placeholder="Notes for this section (optional)"
          placeholderTextColor={colors.textMuted}
          multiline
        />
      ) : section.notes.trim() ? (
        <Text style={styles.notes}>{section.notes.trim()}</Text>
      ) : null}
    </View>
  );
}

const BAR_WIDTH = 74;

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  headerRowEdit: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  labelInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textStrong,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  bars: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  bar: {
    width: BAR_WIDTH,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
  },
  barEditable: {
    borderStyle: "dashed",
  },
  barText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: colors.textStrong,
  },
  barTextEmpty: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  barControls: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  barControlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
  },
  barControlText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.primary,
  },
  barControlTextMuted: {
    color: colors.textSecondary,
  },
  notes: {
    ...textTokens.supporting,
    marginTop: spacing.sm,
  },
  notesInput: {
    ...textTokens.supporting,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    minHeight: 38,
  },
});
