import { Pressable, Text, View } from "react-native";
import { clipLineageStyles } from "../styles";

type SortMode = "chronological" | "custom";

type ClipLineageSortToggleProps = {
  sortMode: SortMode;
  onChangeMode: (next: SortMode) => void;
};

export function ClipLineageSortToggle({
  sortMode,
  onChangeMode,
}: ClipLineageSortToggleProps) {
  return (
    <View style={clipLineageStyles.sortToggle}>
      {(["chronological", "custom"] as const).map((mode) => {
        const active = sortMode === mode;
        return (
          <Pressable
            key={mode}
            style={[
              clipLineageStyles.sortTab,
              active ? clipLineageStyles.sortTabActive : null,
            ]}
            onPress={() => onChangeMode(mode)}
          >
            <Text
              style={[
                clipLineageStyles.sortTabText,
                active ? clipLineageStyles.sortTabTextActive : null,
              ]}
            >
              {mode === "chronological" ? "Chronological" : "Custom"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
