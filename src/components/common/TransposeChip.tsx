import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../design/tokens";
import { formatTransposeOffset } from "../../domain/transpose";
import { useTranslation } from "react-i18next";
import { Stepper } from "./Stepper";
import { Press } from "./Press";
import { ensureProFor } from "./proUpsell";

type TransposeChipProps = {
  /** The song the chart belongs to: transposing a received parcel's chart is free. */
  ideaId: string;
  offset: number;
  onNudge: (delta: number) => void;
  onReset: () => void;
};

/** The display-transpose stepper — shared by the chord sheet, the lyric chart,
 *  and the songbook reader so "transpose" feels like one feature. The kit
 *  Stepper (bare ink glyphs, its own step haptic) around a named value; a bare
 *  reset glyph appears only while shifted. Display-level only. */
export function TransposeChip({ ideaId, offset, onNudge, onReset }: TransposeChipProps) {
  const { t } = useTranslation();
  const value = formatTransposeOffset(offset);
  return (
    <View style={chipStyles.row}>
      <Text style={chipStyles.label}>{t("common.transpose")}</Text>
      <Stepper
        glyphs="plusMinus"
        onStep={(direction) => {
          // Transpose is a stage tool (domain/proCatalog.ts); the written key always shows,
          // and a received parcel's chart transposes for everyone.
          if (!ensureProFor("stage-tools", ideaId)) return;
          onNudge(direction);
        }}
        decrementLabel={t("common.transposeDown")}
        incrementLabel={t("common.transposeUp")}
      >
        <Text
          style={[chipStyles.value, offset !== 0 ? chipStyles.valueActive : null]}
          accessibilityLabel={t("common.transposeValue", { value })}
        >
          {value}
        </Text>
      </Stepper>
      {offset !== 0 ? (
        <Press
          feel="glyph"
          // haptics.ts: light → a small state flip.
          haptic="light"
          onPress={onReset}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.resetWrittenKey")}
          style={chipStyles.reset}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.textStrong} />
        </Press>
      ) : null}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textSecondary,
    marginEnd: 2,
  },
  value: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
    minWidth: 24,
    textAlign: "center",
  },
  valueActive: {
    color: colors.primaryDeep,
  },
  reset: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});
