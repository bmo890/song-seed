import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WarmModal } from "../../common/WarmModal";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing } from "../../../design/tokens";
import { MAX_CHORDS_PER_BAR } from "../../../chordSheet";

const BARLINE = "#BCA59B";

/** Focused, centered editor for a single bar: shows the bar with its chords (tap
 * one to change or delete it) and a + to add one. The chord picker launches from
 * here. Deliberately minimal — just the bar, an add button, and done. */
export function BarEditorSheet({
  visible,
  chords,
  onAddChord,
  onEditChord,
  onClose,
}: {
  visible: boolean;
  chords: string[];
  onAddChord: () => void;
  onEditChord: (index: number) => void;
  onClose: () => void;
}) {
  const full = chords.length >= MAX_CHORDS_PER_BAR;

  return (
    <WarmModal visible={visible} onRequestClose={onClose}>
      <View style={styles.bar}>
        {chords.length === 0 ? (
          <Text style={styles.rest}>—</Text>
        ) : (
          chords.map((chord, index) => (
            <Pressable
              key={index}
              style={({ pressed }) => [styles.chordHit, pressed ? appStyles.pressDown : null]}
              onPress={() => onEditChord(index)}
            >
              <Text style={styles.chord}>{chord}</Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.addCircle, full ? styles.addDisabled : null, pressed && !full ? appStyles.pressDown : null]}
          onPress={onAddChord}
          disabled={full}
          accessibilityLabel="Add chord"
        >
          <Ionicons name="add" size={22} color={full ? colors.textMuted : colors.onPrimary} />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.doneBtn, pressed ? appStyles.pressDown : null]} onPress={onClose}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </WarmModal>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: "center",
    minWidth: 150,
    maxWidth: "100%",
    height: 92,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    columnGap: spacing.md,
    rowGap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginVertical: spacing.sm,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderLeftColor: BARLINE,
    borderRightColor: BARLINE,
  },
  chordHit: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  chord: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 22,
    color: colors.textPrimary,
  },
  rest: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 20,
    color: colors.borderMuted,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  addCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addDisabled: {
    backgroundColor: colors.surfaceHigh,
  },
  doneBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  doneText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.primary,
  },
});
