import { Text, View } from "react-native";
import { styles } from "../../styles";
import { useTranslation } from "react-i18next";

export function SongClipListParentPickHint() {
  const { t } = useTranslation();
  return (
    <View style={styles.songDetailParentPickInlineHint}>
      <Text style={styles.songDetailParentPickInlineTitle}>{t("songDetail.chooseParent")}</Text>
      <Text style={styles.songDetailParentPickInlineText}>{t("songDetail.chooseParentHint")}</Text>
    </View>
  );
}
