import { Pressable, Text, View } from "react-native";
import { styles } from "../../styles";
import { useTranslation } from "react-i18next";

/** Primary as editorial ink — dot + word, one terracotta with the card's crown
 *  rule so the two read as a single signal rather than two decorations. */
export function PrimaryInk({ label }: { label: string }) {
  return (
    <View style={styles.songDetailPrimaryInk}>
      <View style={styles.songDetailPrimaryInkDot} />
      <Text style={styles.songDetailPrimaryInkText}>{label}</Text>
    </View>
  );
}

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

  // The PRIMARY mark itself now rides the title row (see IdeaCard's
  // titleAccessory) — the trailing slot only carries the edit-mode ACTION.
  if (isEditMode && !isPrimaryCandidate) {
    return (
      <Pressable style={styles.songDetailVersionSetPrimaryBtn} onPress={onSetPrimary}>
        <Text style={styles.songDetailVersionSetPrimaryText}>{t("common.primary")}</Text>
      </Pressable>
    );
  }

  return null;
}
