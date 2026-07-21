import { Pressable, Text, View } from "react-native";
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
        <Pressable
          style={({ pressed }) => [styles.ideasUndoBtn, pressed ? styles.pressDown : null]}
          onPress={() => {
            undo.undoState?.undo();
            undo.clearUndo();
          }}
        >
          <Text style={styles.ideasUndoBtnText}>{t("chordChart.undo")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
