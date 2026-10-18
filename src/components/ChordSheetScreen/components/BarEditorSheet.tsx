import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WarmModal } from "../../common/WarmModal";
import { Press } from "../../common/Press";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { Button } from "../../common/Button";
import { colors, spacing } from "../../../design/tokens";
import { MAX_CHORDS_PER_BAR } from "../../../domain/chordSheet";
import { tidyChordName } from "../../../domain/chords";
import { useTranslation } from "react-i18next";

const BARLINE = "#BCA59B";

/** Focused, centered editor for a single bar: shows the bar with its chords (tap
 * one to change or delete it) and an ink "Add chord" key. Deliberately minimal —
 * just the bar, add, and done.
 *
 * The chord picker opens from INSIDE this modal (`children`): iOS will not
 * present a second modal over this one from beside it, so a picker rendered
 * as a sibling never appeared and "+" did nothing (2026-10-18). */
export function BarEditorSheet({
  visible,
  chords,
  onAddChord,
  onEditChord,
  onClose,
  children,
}: {
  visible: boolean;
  chords: string[];
  onAddChord: () => void;
  onEditChord: (index: number) => void;
  onClose: () => void;
  /** The chord picker, hosted inside this modal. */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const full = chords.length >= MAX_CHORDS_PER_BAR;

  return (
    <WarmModal visible={visible} onRequestClose={onClose}>
      <View style={styles.bar}>
        {chords.length === 0 ? (
          <Text style={styles.rest}>—</Text>
        ) : (
          chords.map((chord, index) => (
            <Press
              key={index}
              feel="glyph"
              // haptics.ts: tap → a control acted (opens the picker).
              haptic="tap"
              style={styles.chordHit}
              onPress={() => onEditChord(index)}
              accessibilityRole="button"
              accessibilityLabel={t("chordEditor.editChord")}
            >
              <Text style={styles.chord}>{tidyChordName(chord)}</Text>
            </Press>
          ))
        )}
      </View>

      <View style={styles.footer}>
        <InkKey
          glyph={<Ionicons name="add" size={18} color={inkKeyColor(full ? "off" : "idle")} />}
          label={t("chordChart.addChord")}
          tone={full ? "off" : "idle"}
          onPress={() => {
            if (!full) onAddChord();
          }}
        />
        <Button label={t("chordChart.done")} variant="secondary" onPress={onClose} />
      </View>
      {children}
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
    color: colors.textStrong,
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
});
