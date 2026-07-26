import { IconButton } from "../../../common/IconButton";
import { useTranslation } from "react-i18next";

type SongClipSortTriggerProps = {
  direction: "asc" | "desc";
  onPress: () => void;
};

/** Bare glyph sort toggle — one tap flips asc ↔ desc; the arrow tells the
 *  current direction. Glyphs, not chips (collection toolbar language). */
export function SongClipSortTrigger({ direction, onPress }: SongClipSortTriggerProps) {
  const { t } = useTranslation();
  return (
    <IconButton
      icon={direction === "desc" ? "arrow-down" : "arrow-up"}
      tone="muted"
      size={18}
      onPress={onPress}
      accessibilityLabel={t(direction === "desc" ? "songDetail.newestFirst" : "songDetail.oldestFirst")}
    />
  );
}
