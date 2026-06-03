import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clipLineageStyles } from "../styles";

type SortDirection = "asc" | "desc";

type ClipLineageSortToggleProps = {
  direction: SortDirection;
  onToggle: () => void;
};

export function ClipLineageSortToggle({
  direction,
  onToggle,
}: ClipLineageSortToggleProps) {
  return (
    <View style={clipLineageStyles.sortToggleRow}>
      <Pressable
        style={({ pressed }) => [
          clipLineageStyles.sortDirectionPill,
          pressed ? clipLineageStyles.sortDirectionPillPressed : null,
        ]}
        onPress={onToggle}
      >
        <Ionicons
          name={direction === "asc" ? "arrow-up" : "arrow-down"}
          size={11}
          color="#84736f"
        />
        <Text style={clipLineageStyles.sortDirectionText}>
          {direction === "asc" ? "Oldest first" : "Newest first"}
        </Text>
      </Pressable>
    </View>
  );
}
