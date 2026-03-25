import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";

type ClipCardReplyButtonProps = {
  visible: boolean;
  compact: boolean;
  onPress: () => void | Promise<void>;
};

export function ClipCardReplyButton({
  visible,
  compact,
  onPress,
}: ClipCardReplyButtonProps) {
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
      <Ionicons name="return-up-forward-outline" size={14} color="#475569" />
    </Pressable>
  );
}
