import { Text, View } from "react-native";
import { styles } from "../../styles";

type SongClipListSectionLabelProps = {
  title: string;
  /** Omitted when the count is already said elsewhere on the page. */
  count?: number;
};

export function SongClipListSectionLabel({
  title,
  count,
}: SongClipListSectionLabelProps) {
  return (
    <View style={styles.songDetailSectionHeaderCopy}>
      <Text style={styles.songDetailSectionTitle}>{title}</Text>
      {count !== undefined ? <Text style={styles.songDetailSectionMeta}>{count}</Text> : null}
    </View>
  );
}
