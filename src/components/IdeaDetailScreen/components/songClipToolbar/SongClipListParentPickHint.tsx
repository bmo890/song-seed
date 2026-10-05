import { Text, View } from "react-native";
import { styles } from "../../styles";
import { useTranslation } from "react-i18next";

export function SongClipListParentPickHint() {
  const { t } = useTranslation();
  return (
    <View style={styles.songDetailParentPickInlineHint}>
      {/* The banner above already names the action; here, just where to tap. */}
      <Text style={styles.songDetailParentPickInlineText}>{t("songDetail.chooseParentHint")}</Text>
    </View>
  );
}
