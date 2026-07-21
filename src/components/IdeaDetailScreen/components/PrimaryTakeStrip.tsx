import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { type TimelineClipEntry } from "../../../domain/clipGraph";
import { useSongScreen } from "../provider/SongScreenProvider";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

type PrimaryTakeStripProps = {
  entry: TimelineClipEntry;
  onLocate: () => void;
};

export function PrimaryTakeStrip({ entry, onLocate }: PrimaryTakeStripProps) {
  const { t } = useTranslation();
  const { actions } = useSongScreen();
  const clip = entry.clip;

  return (
    <View style={styles.songDetailPrimaryStrip}>
      <View style={styles.songDetailPrimaryStripAccent} />
      <Pressable
        style={({ pressed }) => [
          styles.songDetailPrimaryStripPlay,
          pressed ? styles.pressDown : null,
        ]}
        onPress={() => actions.playProjectQueue([clip.id])}
        accessibilityRole="button"
        accessibilityLabel={t("songDetail.playPrimaryTake")}
      >
        <Ionicons name="play" size={15} color={colors.surface} />
      </Pressable>
      <View style={styles.songDetailPrimaryStripCopy}>
        <Text style={styles.songDetailPrimaryStripLabel}>{t("songDetail.primaryTake")}</Text>
        <UserText value={clip.title} style={styles.songDetailPrimaryStripTitle} numberOfLines={1}>
          {clip.title || t("common.untitled")}
        </UserText>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.songDetailPrimaryStripLocate,
          pressed ? styles.pressDown : null,
        ]}
        onPress={onLocate}
        accessibilityRole="button"
        accessibilityLabel={t("songDetail.findPrimaryTake")}
      >
        <Ionicons name="locate-outline" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}
