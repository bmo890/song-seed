import { Text, View } from "react-native";
import { styles } from "../../styles";

export function SongClipListParentPickHint() {
  return (
    <View style={styles.songDetailParentPickInlineHint}>
      <Text style={styles.songDetailParentPickInlineTitle}>Choose parent clip</Text>
      <Text style={styles.songDetailParentPickInlineText}>Tap any available clip below.</Text>
    </View>
  );
}
