import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { styles } from "../../styles";

type Props = {
  count: number;
  /** True when everything selectable is already selected — disables the All chip. */
  allSelected: boolean;
  /** Selects all items. Omit to hide the All chip (e.g. pickers without select-all). */
  onSelectAll?: () => void;
  /** Exits selection mode. */
  onCancel: () => void;
};

/** Bar rendered at the bottom of the header block (top of the timeline) during
 *  selection mode — count, bordered "All" chip, and Cancel. */
export function SelectionTopBar({ count, allSelected, onSelectAll, onCancel }: Props) {
  const { t } = useTranslation();
  return (
    <Animated.View
      style={styles.selectionTopBar}
      entering={FadeInDown.duration(180)}
      exiting={FadeOut.duration(120)}
    >
      <Text style={styles.selectionTopBarCount}>{t("common.selected", { count })}</Text>

      {onSelectAll ? (
        <Pressable
          style={({ pressed }) => [
            styles.selectionTopBarChip,
            allSelected ? { opacity: 0.35 } : null,
            pressed && !allSelected ? styles.pressDown : null,
          ]}
          onPress={onSelectAll}
          disabled={allSelected}
          accessibilityRole="button"
          accessibilityLabel={t("common.selectAll")}
        >
          <Text style={styles.selectionTopBarChipText}>{t("common.all")}</Text>
        </Pressable>
      ) : null}

      <View style={{ flex: 1 }} />

      <Pressable
        style={({ pressed }) => [
          styles.selectionTopBarCancelBtn,
          pressed ? styles.pressDown : null,
        ]}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t("common.cancelSelection")}
      >
        <Text style={styles.selectionTopBarCancelBtnText}>{t("common.cancel")}</Text>
      </Pressable>
    </Animated.View>
  );
}
