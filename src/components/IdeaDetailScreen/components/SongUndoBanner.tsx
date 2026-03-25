import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";

export function SongUndoBanner() {
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
          <Text style={styles.ideasUndoBtnText}>Undo</Text>
        </Pressable>
      </View>
    </View>
  );
}
