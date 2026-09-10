import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { styles } from "../../styles";
import { haptic } from "../../design/haptics";

type Props = {
  count: number;
  /** True when everything selectable is already selected — disables the All chip. */
  allSelected: boolean;
  /** Selects all items. Omit to hide the All chip (e.g. pickers without select-all). */
  onSelectAll?: () => void;
  /** Exits selection mode. */
  onCancel: () => void;
  /** Stretch over the chrome the bar replaces (search/filter rows) instead of
   *  inserting into the flow — selection must never push the list downward. */
  overlay?: boolean;
  /** Sit inside an existing toolbar row (trailing stretch) instead of owning
   *  one — used where only the filter/sort controls yield to selection and the
   *  search field beside them stays live. */
  inline?: boolean;
  /** Container override — e.g. matching a tinted header's background. */
  style?: StyleProp<ViewStyle>;
};

/** Selection-mode controls — count, "All" ink, Cancel soft key — in the sketch
 *  page's quiet register: chrome swapped in place, not a floating card. */
export function SelectionTopBar({ count, allSelected, onSelectAll, onCancel, overlay, inline, style }: Props) {
  const { t } = useTranslation();
  return (
    <Animated.View
      style={[
        styles.selectionTopBar,
        overlay ? styles.selectionTopBarOverlay : null,
        inline ? styles.selectionTopBarInline : null,
        style,
      ]}
      entering={FadeInDown.duration(180)}
      exiting={FadeOut.duration(120)}
    >
      <Text style={styles.selectionTopBarCount} testID="selection-count">
        {t("common.selected", { count })}
      </Text>

      {onSelectAll ? (
        <Pressable
          style={({ pressed }) => [
            allSelected ? { opacity: 0.35 } : null,
            pressed && !allSelected ? styles.pressDown : null,
          ]}
          onPress={() => {
            haptic.tap();
            onSelectAll();
          }}
          disabled={allSelected}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={t("common.selectAll")}
        >
          <Text style={styles.selectionTopBarChipText}>{t("common.all")}</Text>
        </Pressable>
      ) : null}

      {inline ? null : <View style={{ flex: 1 }} />}

      <Pressable
        testID="selection-cancel"
        style={({ pressed }) => [
          styles.selectionTopBarCancelBtn,
          pressed ? styles.pressDown : null,
        ]}
        onPress={() => {
          haptic.tap();
          onCancel();
        }}
        accessibilityRole="button"
        accessibilityLabel={t("common.cancelSelection")}
      >
        <Text style={styles.selectionTopBarCancelBtnText}>{t("common.cancel")}</Text>
      </Pressable>
    </Animated.View>
  );
}
