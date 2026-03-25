import { Text, View } from "react-native";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";

export function SongParentPickBanner() {
  const { parentPicking } = useSongScreen();

  if (!parentPicking.parentPickState) {
    return null;
  }

  return (
    <View style={styles.selectionBar}>
      <View style={styles.songDetailParentPickCopy}>
        <Text style={styles.selectionText}>Choose parent clip</Text>
        <Text style={styles.songDetailParentPickHelper}>{parentPicking.parentPickPrompt}</Text>
        {parentPicking.parentPickMeta ? (
          <Text style={styles.songDetailParentPickMeta}>{parentPicking.parentPickMeta}</Text>
        ) : null}
      </View>
      <View style={styles.rowButtons}>
        <Button
          variant="secondary"
          label="Cancel"
          onPress={() => parentPicking.setParentPickState(null)}
        />
      </View>
    </View>
  );
}
