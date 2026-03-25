import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";

type SongClipFilterTriggerProps = {
  active: boolean;
  open: boolean;
  onPress: () => void;
  onClear: () => void;
};

export function SongClipFilterTrigger({
  active,
  open,
  onPress,
  onClear,
}: SongClipFilterTriggerProps) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.ideasUtilityChip,
          styles.ideasUtilityChipFilterOnly,
          open ? styles.ideasUtilityChipOpen : null,
          pressed ? styles.pressDown : null,
        ]}
        onPress={onPress}
      >
        <Ionicons
          name={(active ? "funnel" : "funnel-outline") as any}
          size={15}
          color={active ? "#0f172a" : "#475569"}
        />
        <View
          style={[
            styles.ideasUtilityChipDivider,
            active ? styles.ideasUtilityChipDividerActive : null,
          ]}
        />
        <Ionicons name="pricetag-outline" size={16} color="#475569" />
      </Pressable>

      {active ? (
        <Pressable
          style={({ pressed }) => [
            styles.ideasUtilityClearIconBtn,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear filters"
        >
          <Ionicons name="close" size={12} color="#64748b" />
        </Pressable>
      ) : null}
    </>
  );
}
