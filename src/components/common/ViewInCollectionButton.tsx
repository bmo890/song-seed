import { IconButton } from "./IconButton";
import { colors } from "../../design/tokens";

/**
 * "Show me where this lives." One glyph, one meaning, everywhere a card sits
 * OUTSIDE its collection (Activity, Shelf, Revisit, the queue, playlists): the
 * card opens the thing; this opens the thing's collection as a visit, scrolled
 * to the card and highlighting it.
 *
 * The glyph stays a quiet 15 pt, but the target is a real ~45 pt — it sits inside
 * a card whose whole surface opens the sketch, so a near miss used to land there
 * instead. Navigation is silent (no haptic), and the press never reaches the card.
 */
export function ViewInCollectionButton({
  onPress,
  accessibilityLabel,
  testID,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  return (
    <IconButton
      icon="open-outline"
      size={15}
      color={colors.textMuted}
      hitSlop={15}
      stopPropagation
      noHaptic
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    />
  );
}
