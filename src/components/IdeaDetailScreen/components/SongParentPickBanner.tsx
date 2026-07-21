import { Text, View } from "react-native";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";
import { useTranslation } from "react-i18next";

export function SongParentPickBanner() {
  const { t } = useTranslation();
  const { parentPicking } = useSongScreen();

  if (!parentPicking.parentPickState) {
    return null;
  }

  return (
    <View style={styles.selectionBar}>
      <View style={styles.songDetailParentPickCopy}>
        <Text style={styles.selectionText}>{t("songDetail.chooseParent")}</Text>
        <Text style={styles.songDetailParentPickHelper}>{parentPicking.parentPickPrompt}</Text>
        {parentPicking.parentPickMeta ? (
          <Text style={styles.songDetailParentPickMeta}>{parentPicking.parentPickMeta}</Text>
        ) : null}
      </View>
      <View style={styles.rowButtons}>
        <Button
          variant="secondary"
          label={t("common.cancel")}
          onPress={() => parentPicking.setParentPickState(null)}
        />
      </View>
    </View>
  );
}
