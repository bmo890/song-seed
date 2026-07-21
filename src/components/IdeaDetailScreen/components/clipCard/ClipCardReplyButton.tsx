import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { styles } from "../../styles";
import { colors } from "../../../../design/tokens";

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
  const { t } = useTranslation();
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
      accessibilityRole="button"
      accessibilityLabel={t("clipLineage.recordTakeA11y")}
    >
      <Ionicons name="mic-outline" size={15} color={colors.textSecondary} />
    </Pressable>
  );
}
