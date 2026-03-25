import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MiniProgress } from "../../../MiniProgress";
import { styles } from "../../styles";

type ClipCardInlinePlayerProps = {
  currentMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
  onSeekStart: () => void;
  onSeekCancel: () => void;
  onClose: () => void;
};

export function ClipCardInlinePlayer({
  currentMs,
  durationMs,
  onSeek,
  onSeekStart,
  onSeekCancel,
  onClose,
}: ClipCardInlinePlayerProps) {
  return (
    <View style={styles.songDetailVersionInlinePlayerWrap}>
      <View style={styles.songDetailVersionInlinePlayerProgress}>
        <MiniProgress
          currentMs={currentMs}
          durationMs={durationMs}
          onSeek={onSeek}
          onSeekStart={onSeekStart}
          onSeekCancel={onSeekCancel}
        />
      </View>
      <Pressable
        style={styles.ideasInlineCloseBtn}
        onPress={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <Ionicons name="close" size={13} color="#64748b" />
      </Pressable>
    </View>
  );
}
