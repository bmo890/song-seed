import { Pressable, Text, View, type GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";

type ClipTagPresentation = {
  key: string;
  label: string;
  backgroundColor: string;
  textColor: string;
};

type ClipTagBadgesProps = {
  tags: ClipTagPresentation[];
  disabled?: boolean;
  showAddButton?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
};

export function ClipTagBadges({
  tags,
  disabled,
  showAddButton,
  onPress,
}: ClipTagBadgesProps) {
  if (tags.length === 0 && !showAddButton) {
    return null;
  }

  return (
    <Pressable
      style={styles.clipCardTagsRow}
      onPress={disabled ? undefined : onPress}
      hitSlop={disabled ? undefined : { top: 2, bottom: 2 }}
      disabled={disabled}
    >
      {tags.map((tag) => (
        <View key={tag.key} style={[styles.clipCardTagBadge, { backgroundColor: tag.backgroundColor }]}>
          <Text style={[styles.clipCardTagBadgeText, { color: tag.textColor }]}>{tag.label}</Text>
        </View>
      ))}
      {showAddButton ? (
        <View style={styles.clipCardAddTagBtn}>
          <Ionicons name="add" size={11} color="#94a3b8" />
        </View>
      ) : null}
    </Pressable>
  );
}
