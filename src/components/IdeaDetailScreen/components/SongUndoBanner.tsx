import { Text, View } from "react-native";
import { Press } from "../../common/Press";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";
import { useTranslation } from "react-i18next";

export function SongUndoBanner() {
  const { t } = useTranslation();
  const { undo } = useSongScreen();

  if (!undo.undoState) {
    return null;
  }

  return (
    <View style={[styles.ideasUndoWrap, { bottom: undo.songUndoBottom }]}>
      <View style={styles.ideasUndoCard}>
        <Text style={styles.ideasUndoText} numberOfLines={1}>
          {undo.undoState.message}
        </Text>
        <Press
          haptic="none"
          style={styles.ideasUndoBtn}
          onPress={() => {
            undo.undoState?.undo();
            undo.clearUndo();
          }}
        >
          <Text style={styles.ideasUndoBtnText}>{t("chordChart.undo")}</Text>
        </Press>
      </View>
    </View>
  );
}
