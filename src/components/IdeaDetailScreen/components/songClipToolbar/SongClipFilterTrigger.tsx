import { IconButton } from "../../../common/IconButton";
import { colors } from "../../../../design/tokens";
import { useTranslation } from "react-i18next";

type SongClipFilterTriggerProps = {
  active: boolean;
  open: boolean;
  onPress: () => void;
  onClear: () => void;
};

/** Bare glyph filter trigger — active state is told by the filled glyph +
 *  terracotta ink, never by a border or fill (collection toolbar language). */
export function SongClipFilterTrigger({ active, open, onPress }: SongClipFilterTriggerProps) {
  const { t } = useTranslation();
  return (
    <IconButton
      icon={active || open ? "funnel" : "funnel-outline"}
      tone="muted"
      color={active ? colors.primaryDeep : undefined}
      size={18}
      onPress={onPress}
      accessibilityLabel={t("songDetail.filterByTag")}
    />
  );
}
