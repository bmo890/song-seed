import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../../../common/Press";
import { useSongScreen } from "../../provider/SongScreenProvider";
import { colors } from "../../../../design/tokens";

/**
 * Choosing the take a take grew from (2026-10-15): one quiet line in the
 * toolbar's place, "Tap the take it grew from" with Cancel beside it. It
 * replaces the banner + hint box pair; the cards stay as they are, the
 * moving take fades, the ones it can't join dim.
 */
export function SongClipListParentPickHint() {
  const { t } = useTranslation();
  const { parentPicking } = useSongScreen();
  return (
    <View style={s.row}>
      <Text style={s.text} numberOfLines={1}>
        {t("songDetail.chooseParent")}
      </Text>
      <Press
        feel="glyph"
        haptic="tap"
        hitSlop={8}
        onPress={() => parentPicking.setParentPickState(null)}
        accessibilityRole="button"
      >
        <Text style={s.cancel}>{t("common.cancel")}</Text>
      </Press>
    </View>
  );
}

const s = StyleSheet.create({
  // Same height as the toolbar row it stands in for, so nothing shifts.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 46,
  },
  text: {
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
  },
  cancel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.primaryDeep,
  },
});
