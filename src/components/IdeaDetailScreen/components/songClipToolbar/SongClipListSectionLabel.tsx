import { Text, View } from "react-native";
import { styles } from "../../styles";

type SongClipListSectionLabelProps = {
  title: string;
  count: number;
};

export function SongClipListSectionLabel({
  title,
  count,
}: SongClipListSectionLabelProps) {
  return (
    <View style={styles.songDetailSectionHeaderCopy}>
      <Text style={styles.songDetailSectionTitle}>{title}</Text>
      <Text style={styles.songDetailSectionMeta}>{count}</Text>
    </View>
  );
}
