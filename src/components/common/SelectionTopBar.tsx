import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
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
  return (
    <Animated.View
      style={styles.selectionTopBar}
      entering={FadeInDown.duration(180)}
      exiting={FadeOut.duration(120)}
    >
      <Text style={styles.selectionTopBarCount}>{count} selected</Text>

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
          accessibilityLabel="Select all"
        >
          <Text style={styles.selectionTopBarChipText}>All</Text>
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
        accessibilityLabel="Cancel selection"
      >
        <Text style={styles.selectionTopBarCancelBtnText}>Cancel</Text>
      </Pressable>
    </Animated.View>
  );
}
