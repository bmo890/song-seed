import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { colors } from "../../../../design/tokens";

type SongClipSortTriggerProps = {
  direction: "asc" | "desc";
  onPress: () => void;
};

export function SongClipSortTrigger({ direction, onPress }: SongClipSortTriggerProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.ideasUtilityChip,
        styles.ideasUtilityChipIconOnly,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={direction === "desc" ? "Newest first — tap for oldest first" : "Oldest first — tap for newest first"}
    >
      <View style={styles.ideasSortChipIconStack}>
        <Ionicons
          name="arrow-up"
          size={11}
          color={direction === "asc" ? colors.textStrong : "#c4b5b0"}
        />
        <Ionicons
          name="arrow-down"
          size={11}
          color={direction === "desc" ? colors.textStrong : "#c4b5b0"}
        />
      </View>
    </Pressable>
  );
}
