import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import type { RevisitSourceOption } from "../../../revisit";
import { revisitStyles } from "../styles";

type RevisitSourceChipProps = {
  option: RevisitSourceOption;
  onPress: () => void;
};

export function RevisitSourceChip({ option, onPress }: RevisitSourceChipProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        revisitStyles.filterChip,
        option.included ? revisitStyles.filterChipIncluded : revisitStyles.filterChipExcluded,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={option.included ? "checkmark-circle" : "ellipse-outline"}
        size={16}
        color={option.included ? "#824f3f" : "#84736f"}
      />
      <Text
        style={[
          revisitStyles.filterChipText,
          option.included ? revisitStyles.filterChipTextIncluded : null,
        ]}
        numberOfLines={2}
      >
        {option.label}
      </Text>
      <View style={revisitStyles.filterChipCount}>
        <Text style={revisitStyles.filterChipCountText}>{option.count}</Text>
      </View>
    </Pressable>
  );
}
