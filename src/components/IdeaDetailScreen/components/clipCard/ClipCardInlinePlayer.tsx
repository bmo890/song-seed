import Animated, { FadeIn } from "react-native-reanimated";
import { MiniProgress } from "../../../MiniProgress";
import { CloseButton } from "../../../common/CloseButton";
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
    // entering only: exiting animations inside recycled list rows misbehave.
    <Animated.View style={styles.songDetailVersionInlinePlayerWrap} entering={FadeIn.duration(160)}>
      <MiniProgress
        compact
        flankTimes
        currentMs={currentMs}
        durationMs={durationMs}
        onSeek={onSeek}
        onSeekStart={onSeekStart}
        onSeekCancel={onSeekCancel}
        trailingAccessory={
          <CloseButton size="sm" tone="onLight" accessibilityLabel="Stop preview" onPress={onClose} />
        }
      />
    </Animated.View>
  );
}
