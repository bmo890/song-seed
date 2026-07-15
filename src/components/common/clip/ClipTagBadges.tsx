import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { colors } from "../../../design/tokens";

type ClipTagPresentation = {
  key: string;
  label: string;
  backgroundColor: string;
  textColor: string;
};

type ClipTagSuggestion = {
  key: string;
  label: string;
  textColor: string;
};

type ClipTagBadgesProps = {
  tags: ClipTagPresentation[];
  disabled?: boolean;
  showAddButton?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  /** One-tap "we noticed this might be a Chorus" chips. Each applies its tag. */
  suggestions?: ClipTagSuggestion[];
  onApplySuggestion?: (key: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
};

export function ClipTagBadges({
  tags,
  disabled,
  showAddButton,
  onPress,
  suggestions,
  onApplySuggestion,
  containerStyle,
}: ClipTagBadgesProps) {
  const hasSuggestions = !disabled && !!suggestions && suggestions.length > 0;
  const showTapZone = tags.length > 0 || showAddButton;
  if (!showTapZone && !hasSuggestions) {
    return null;
  }

  return (
    <View style={[styles.clipCardTagsRow, containerStyle]}>
      {showTapZone ? (
        <Pressable
          style={localStyles.tapZone}
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
            tags.length === 0 ? (
              <View style={localStyles.addTagIcon}>
                <Ionicons name="pricetag-outline" size={15} color={colors.textMuted} />
              </View>
            ) : (
              <View style={styles.clipCardAddTagBtn}>
                <Ionicons name="add" size={11} color={colors.textSecondary} />
              </View>
            )
          ) : null}
        </Pressable>
      ) : null}

      {hasSuggestions
        ? suggestions!.map((suggestion) => (
            <Pressable
              key={suggestion.key}
              style={({ pressed }) => [
                localStyles.suggestChip,
                { borderColor: suggestion.textColor },
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => onApplySuggestion?.(suggestion.key)}
              hitSlop={{ top: 2, bottom: 2 }}
              accessibilityRole="button"
              accessibilityLabel={`Add ${suggestion.label} tag`}
            >
              <Ionicons name="add" size={11} color={suggestion.textColor} />
              <Text style={[localStyles.suggestChipText, { color: suggestion.textColor }]}>
                {suggestion.label}
              </Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

const localStyles = StyleSheet.create({
  tapZone: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  // Empty state: a quiet tag glyph — subtle, but enough to signal "you can tag this".
  addTagIcon: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    opacity: 0.9,
  },
  suggestChipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
  },
});
