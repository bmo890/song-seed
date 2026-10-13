import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Press } from "../../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../../design/tokens";
import type { SongChordPaletteItem } from "../../../../types";

type Props = {
  palette: SongChordPaletteItem[];
  armedId: string | null;
  onToggleArmed: (item: SongChordPaletteItem) => void;
};

/** Persistent quick-insert row in chord-edit mode. Tap a chord to "arm" it, then
 * tap a lyric position to drop it (repeatable). Tap again to disarm. */
export function ChordPaletteBar({ palette, armedId, onToggleArmed }: Props) {
  if (palette.length === 0) return null;
  const armed = palette.find((item) => item.id === armedId) ?? null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {armed ? `Tap a lyric to drop “${armed.displayText}”` : "Tap a chord, then a lyric to place it"}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {palette.map((item) => {
          const active = item.id === armedId;
          return (
            <Press
              haptic="none"
              key={item.id}
              style={[styles.chip,
                active ? styles.chipActive : null]}
              onPress={() => onToggleArmed(item)}
            >
              {active ? <Ionicons name="close" size={12} color={colors.onPrimary} /> : null}
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{item.displayText}</Text>
            </Press>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  label: {
    ...textTokens.annotation,
  },
  row: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.primary,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
});
