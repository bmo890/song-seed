import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";

type ClipCardOverdubButtonProps = {
  visible: boolean;
  compact: boolean;
  onPress: () => void | Promise<void>;
};

export function ClipCardOverdubButton({
  visible,
  compact,
  onPress,
}: ClipCardOverdubButtonProps) {
  if (!visible) return null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.songDetailVersionReplyBtn,
        compact ? styles.songDetailVersionReplyBtnCompact : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={async (event) => {
        event.stopPropagation();
        await onPress();
      }}
    >
      <Ionicons name="mic-outline" size={14} color="#475569" />
    </Pressable>
  );
}
