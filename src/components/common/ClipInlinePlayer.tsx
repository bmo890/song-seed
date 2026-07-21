import { StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { MiniProgress } from "../MiniProgress";
import { CloseButton } from "./CloseButton";
import { useStore } from "../../state/useStore";
import { useTranslation } from "react-i18next";

type ClipInlinePlayerProps = {
  fallbackDurationMs: number;
  onSeek: (ms: number) => void;
  onSeekStart: () => void;
  onSeekCancel: () => void;
  onClose: () => void;
};

/**
 * The single inline preview player shared by EVERY clip card — the collection
 * list, the song-detail (sketch) cards, and the Revisit/Activity rows. One
 * component so they can never drift apart again: elapsed · scrubber · total ·
 * soft close button, all on one row (the ✕ centered on the track line). Reads
 * the live inline position from the store, so whichever card is the active
 * preview target stays in lockstep.
 */
export function ClipInlinePlayer({
  fallbackDurationMs,
  onSeek,
  onSeekStart,
  onSeekCancel,
  onClose,
}: ClipInlinePlayerProps) {
  const { t } = useTranslation();
  const inlinePosition = useStore((s) => s.inlinePositionMs);
  const inlineDuration = useStore((s) => s.inlineDurationMs);

  return (
    // entering only: exiting animations inside recycled list rows misbehave.
    <Animated.View style={styles.wrap} entering={FadeIn.duration(160)}>
      <MiniProgress
        compact
        flankTimes
        currentMs={inlinePosition}
        durationMs={inlineDuration || fallbackDurationMs}
        onSeek={onSeek}
        onSeekStart={onSeekStart}
        onSeekCancel={onSeekCancel}
        trailingAccessory={
          <CloseButton size="sm" tone="onLight" accessibilityLabel={t("common.stopPreview")} onPress={onClose} />
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 3,
  },
});
