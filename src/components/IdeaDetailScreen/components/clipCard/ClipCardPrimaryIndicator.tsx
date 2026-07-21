import { Pressable, Text } from "react-native";
import { styles } from "../../styles";
import { useTranslation } from "react-i18next";

type ClipCardPrimaryIndicatorProps = {
  displayOnly?: boolean;
  isParentPickSource: boolean;
  isEditMode: boolean;
  isPrimaryCandidate: boolean;
  isPrimary: boolean;
  onSetPrimary: () => void;
};

export function ClipCardPrimaryIndicator({
  displayOnly,
  isParentPickSource,
  isEditMode,
  isPrimaryCandidate,
  isPrimary,
  onSetPrimary,
}: ClipCardPrimaryIndicatorProps) {
  const { t } = useTranslation();
  if (displayOnly) return null;

  if (isParentPickSource) {
    return <Text style={styles.badge}>{t("songDetail.source")}</Text>;
  }

  if (isEditMode) {
    if (isPrimaryCandidate) {
      return <Text style={styles.songDetailClipPrimaryLabel}>{t("common.primary")}</Text>;
    }

    return (
      <Pressable style={styles.songDetailVersionSetPrimaryBtn} onPress={onSetPrimary}>
        <Text style={styles.songDetailVersionSetPrimaryText}>{t("common.primary")}</Text>
      </Pressable>
    );
  }

  if (isPrimary) {
    return <Text style={styles.songDetailClipPrimaryLabel}>{t("common.primary")}</Text>;
  }

  return null;
}
