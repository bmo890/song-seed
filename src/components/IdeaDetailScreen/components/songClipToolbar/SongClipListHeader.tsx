import { View } from "react-native";
import { styles } from "../../styles";
import { useSongScreen } from "../../provider/SongScreenProvider";
import { SongClipListParentPickHint } from "./SongClipListParentPickHint";
import { SongClipListToolbar } from "./SongClipListToolbar";

type SongClipListHeaderProps = {
  visibleIdeaCount: number;
};

export function SongClipListHeader({ visibleIdeaCount }: SongClipListHeaderProps) {
  const { parentPicking } = useSongScreen();

  return (
    <View style={styles.songDetailStickyIdeasHeader}>
      {parentPicking.parentPickState ? (
        <SongClipListParentPickHint />
      ) : (
        <SongClipListToolbar visibleIdeaCount={visibleIdeaCount} />
      )}
    </View>
  );
}
