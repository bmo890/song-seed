import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";

type SongClipSortTriggerProps = {
  active: boolean;
  open: boolean;
  direction: "asc" | "desc";
  metricIcon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export function SongClipSortTrigger({
  active,
  open,
  direction,
  metricIcon,
  onPress,
}: SongClipSortTriggerProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.ideasUtilityChip,
        styles.ideasUtilityChipSortOnly,
        open ? styles.ideasUtilityChipOpen : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <View style={styles.ideasSortChipIconStack}>
        <Ionicons
          name="arrow-up"
          size={11}
          color={direction === "asc" ? "#0f172a" : "#94a3b8"}
        />
        <Ionicons
          name="arrow-down"
          size={11}
          color={direction === "desc" ? "#0f172a" : "#94a3b8"}
        />
      </View>
      <View
        style={[
          styles.ideasUtilityChipDivider,
          active || open ? styles.ideasUtilityChipDividerActive : null,
        ]}
      />
      <Ionicons name={metricIcon as any} size={14} color={active ? "#0f172a" : "#475569"} />
    </Pressable>
  );
}
