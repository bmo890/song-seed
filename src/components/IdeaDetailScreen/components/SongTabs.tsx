import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";

const SONG_TABS = [
  { key: "takes", label: "Takes" },
  { key: "lyrics", label: "Lyrics" },
  { key: "notes", label: "Notes" },
] as const;

export function SongTabs() {
  const { screen } = useSongScreen();

  if (!screen.isProject || screen.isEditMode) {
    return null;
  }

  return (
    <View style={styles.songDetailSongTabs}>
      {SONG_TABS.map((tab) => {
        const active = screen.songTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[
              styles.songDetailSongTab,
              active ? styles.songDetailSongTabActive : null,
            ]}
            onPress={() => screen.setSongTab(tab.key)}
          >
            <Text
              style={[
                styles.songDetailSongTabText,
                active ? styles.songDetailSongTabTextActive : null,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
