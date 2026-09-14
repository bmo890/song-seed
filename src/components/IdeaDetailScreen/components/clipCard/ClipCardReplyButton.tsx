import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { styles } from "../../styles";
import { haptic } from "../../../../design/haptics";
import { colors } from "../../../../design/tokens";

type ClipCardReplyButtonProps = {
  visible: boolean;
  onPress: () => void | Promise<void>;
};

/** "New version" on a take with no history: a small ink "+" in the card's
 *  footer. The labeled mic belongs to a thread's stem row; a lone take is just
 *  a card, so its affordance stays a glyph. */
export function ClipCardReplyButton({ visible, onPress }: ClipCardReplyButtonProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <Pressable
      style={({ pressed }) => [styles.songDetailVersionReplyBtn, pressed ? styles.pressDown : null]}
      onPress={async (event) => {
        event.stopPropagation();
        // haptics.ts: tap → any acknowledged press.
        haptic.tap();
        await onPress();
      }}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={t("clipLineage.recordTakeA11y")}
    >
      <Ionicons name="add" size={16} color={colors.primaryDeep} />
    </Pressable>
  );
}
