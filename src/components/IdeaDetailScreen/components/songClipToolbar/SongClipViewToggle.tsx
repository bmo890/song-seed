import { Pressable, Text, View } from "react-native";
import { songClipToolbarStyles } from "./styles";

type SongClipViewToggleProps = {
  clipViewMode: "timeline" | "evolution";
  setClipViewMode: (mode: "timeline" | "evolution") => void;
};

export function SongClipViewToggle({
  clipViewMode,
  setClipViewMode,
}: SongClipViewToggleProps) {
  return (
    <View style={songClipToolbarStyles.viewToggle}>
      <Pressable
        style={[
          songClipToolbarStyles.viewToggleOption,
          clipViewMode === "evolution"
            ? songClipToolbarStyles.viewToggleOptionActive
            : null,
        ]}
        onPress={() => setClipViewMode("evolution")}
      >
        <Text
          style={[
            songClipToolbarStyles.viewToggleText,
            clipViewMode === "evolution" ? songClipToolbarStyles.viewToggleTextActive : null,
          ]}
        >
          Evolution
        </Text>
      </Pressable>
      <Pressable
        style={[
          songClipToolbarStyles.viewToggleOption,
          clipViewMode === "timeline"
            ? songClipToolbarStyles.viewToggleOptionActive
            : null,
        ]}
        onPress={() => setClipViewMode("timeline")}
      >
        <Text
          style={[
            songClipToolbarStyles.viewToggleText,
            clipViewMode === "timeline" ? songClipToolbarStyles.viewToggleTextActive : null,
          ]}
        >
          Timeline
        </Text>
      </Pressable>
    </View>
  );
}
