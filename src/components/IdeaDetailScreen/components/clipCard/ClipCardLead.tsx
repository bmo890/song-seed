import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { styles } from "../../styles";

type ClipCardLeadProps = {
  durationLabel: string;
  inlineActive: boolean;
  inlinePlaying: boolean;
  canToggleInlinePlayback: boolean;
  canPlay: boolean;
  onPressPlay: () => void;
  onLongPress?: () => void;
};

export function ClipCardLead({
  durationLabel,
  inlineActive,
  inlinePlaying,
  canToggleInlinePlayback,
  canPlay,
  onPressPlay,
  onLongPress,
}: ClipCardLeadProps) {
  return (
    <View
      style={[
        styles.songDetailVersionLead,
        inlineActive ? styles.songDetailVersionLeadInlineActive : null,
      ]}
    >
      {canToggleInlinePlayback ? (
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            void Haptics.selectionAsync();
            if (!canPlay) return;
            onPressPlay();
          }}
          onLongPress={onLongPress}
          style={({ pressed }) => [
            styles.ideasInlinePlayBtn,
            pressed ? styles.pressDown : null,
          ]}
        >
          <Ionicons
            name={inlineActive && inlinePlaying ? "pause" : "play"}
            size={15}
            color={!canPlay ? "#9ca3af" : "#111827"}
            style={inlineActive && inlinePlaying ? undefined : { marginLeft: 2 }}
          />
        </Pressable>
      ) : (
        <View style={styles.ideasInlinePlayBtn}>
          <Ionicons name="play" size={15} color="#9ca3af" style={{ marginLeft: 2 }} />
        </View>
      )}
      <View style={styles.songDetailVersionLeadDurationSlot}>
        <Text style={styles.songDetailVersionLeadDurationText}>{durationLabel}</Text>
      </View>
    </View>
  );
}
