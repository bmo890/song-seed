import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { formatTransposeOffset } from "../../domain/transpose";
import { useTranslation } from "react-i18next";

type TransposeChipProps = {
  offset: number;
  onNudge: (delta: number) => void;
  onReset: () => void;
};

/** The display-transpose stepper — shared by the chord sheet, the lyric chart,
 *  and the songbook reader so "transpose" feels like one feature. A reset pill
 *  appears only while shifted. Non-destructive: display-level only. */
export function TransposeChip({ offset, onNudge, onReset }: TransposeChipProps) {
  const { t } = useTranslation();
  return (
    <View style={chipStyles.row}>
      <View style={chipStyles.stepper}>
        <Pressable
          onPress={() => {
            haptic.light();
            onNudge(-1);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.transposeDown")}
          style={({ pressed }) => [chipStyles.stepBtn, pressed ? { opacity: 0.6 } : null]}
        >
          <Text style={chipStyles.stepGlyph}>−</Text>
        </Pressable>
        <Text
          style={[chipStyles.value, offset !== 0 ? chipStyles.valueActive : null]}
          accessibilityLabel={t("common.transposeValue", { value: formatTransposeOffset(offset) })}
        >
          {formatTransposeOffset(offset)}
        </Text>
        <Pressable
          onPress={() => {
            haptic.light();
            onNudge(1);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.transposeUp")}
          style={({ pressed }) => [chipStyles.stepBtn, pressed ? { opacity: 0.6 } : null]}
        >
          <Text style={chipStyles.stepGlyph}>+</Text>
        </Pressable>
      </View>

      {offset !== 0 ? (
        <Pressable
          onPress={() => {
            haptic.light();
            onReset();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.resetWrittenKey")}
          style={({ pressed }) => [chipStyles.resetBtn, pressed ? { opacity: 0.6 } : null]}
        >
          <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.round,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  stepBtn: {
    paddingHorizontal: 2,
  },
  stepGlyph: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.primaryDeep,
    lineHeight: 17,
  },
  value: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
    minWidth: 20,
    textAlign: "center",
  },
  valueActive: {
    color: colors.primaryDeep,
  },
  resetBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.round,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderMuted,
    alignItems: "center",
    justifyContent: "center",
  },
});
