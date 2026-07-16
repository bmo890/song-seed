import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { MiniProgress } from "../../../MiniProgress";
import { CloseButton } from "../../../common/CloseButton";
import { styles } from "../../styles";
import { colors } from "../../../../design/tokens";

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
    // entering only: exiting animations inside recycled list rows misbehave.
    <Animated.View style={styles.songDetailVersionInlinePlayerWrap} entering={FadeIn.duration(160)}>
      <View style={styles.songDetailVersionInlinePlayerProgress}>
        <MiniProgress
          currentMs={currentMs}
          durationMs={durationMs}
          onSeek={onSeek}
          onSeekStart={onSeekStart}
          onSeekCancel={onSeekCancel}
        />
      </View>
      <CloseButton size="sm" tone="onLight" accessibilityLabel="Stop preview" onPress={onClose} />
    </Animated.View>
  );
}
