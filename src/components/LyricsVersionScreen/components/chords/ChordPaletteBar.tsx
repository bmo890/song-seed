import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Press } from "../../../common/Press";
import { colors, radii, spacing, text as textTokens } from "../../../../design/tokens";
import { tidyChordName } from "../../../../domain/chords";
import type { SongChordPaletteItem } from "../../../../types";

type Props = {
  palette: SongChordPaletteItem[];
  armedId: string | null;
  onToggleArmed: (item: SongChordPaletteItem) => void;
};

/** Persistent quick-insert row in chord-edit mode. Tap a chord to "arm" it, then
 * tap a lyric position to drop it (repeatable). Tap again to disarm. Keys match
 * the chord picker's: ink on paper, the armed one in the tonal wash. */
export function ChordPaletteBar({ palette, armedId, onToggleArmed }: Props) {
  const { t } = useTranslation();
  if (palette.length === 0) return null;
  const armed = palette.find((item) => item.id === armedId) ?? null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {armed
          ? t("chordEditor.paletteArmed", { chord: tidyChordName(armed.displayText) })
          : t("chordEditor.paletteHint")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {palette.map((item) => {
          const active = item.id === armedId;
          return (
            <Press
              feel="surface"
              // haptics.ts: light → a small state flip (arming a chord).
              haptic="light"
              key={item.id}
              style={[styles.key, active ? styles.keyActive : null]}
              onPress={() => onToggleArmed(item)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              {active ? <Ionicons name="close" size={12} color={colors.primaryDeep} /> : null}
              <Text style={[styles.keyText, active ? styles.keyTextActive : null]}>
                {tidyChordName(item.displayText)}
              </Text>
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
    color: colors.textSecondary,
  },
  row: {
    flexDirection: "row",
    gap: 4,
  },
  key: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 40,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: radii.lg,
    justifyContent: "center",
  },
  keyActive: {
    backgroundColor: colors.primarySurface,
  },
  keyText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    color: colors.textStrong,
  },
  keyTextActive: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primaryDeep,
  },
});
