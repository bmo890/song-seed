import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { songClipToolbarStyles } from "./styles";

type SongClipViewTriggerProps = {
  active: boolean;
  open: boolean;
  onPress: () => void;
};

export function SongClipViewTrigger({ active, open, onPress }: SongClipViewTriggerProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        songClipToolbarStyles.viewTrigger,
        open ? songClipToolbarStyles.viewTriggerOpen : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="View options"
    >
      <Ionicons name="options-outline" size={15} color="#84736f" />
      <Text style={songClipToolbarStyles.viewTriggerText}>View</Text>
      {active ? <View style={songClipToolbarStyles.viewTriggerDot} /> : null}
    </Pressable>
  );
}
