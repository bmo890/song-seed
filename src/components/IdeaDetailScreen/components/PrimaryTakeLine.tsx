import { Text, View } from "react-native";
import { Press } from "../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { type ClipVersion } from "../../../types";
import { useSongScreen } from "../provider/SongScreenProvider";
import { isClipTitleAutoNamed } from "../../../domain/clipPresentation";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

type PrimaryTakeLineProps = {
  clip: ClipVersion;
  /** Takes the list to the take. Absent on the other tabs, where the name
   *  opens the Takes tab instead. */
  onLocate?: () => void;
};

/**
 * The sketch's face, one line under the meta (2026-10-15): a bare play glyph,
 * the take's name, and the words "Primary take", so nobody has to guess what
 * the line is. No rail, no box, no locate glyph: the name is the way to the
 * take in the list.
 */
export function PrimaryTakeLine({ clip, onLocate }: PrimaryTakeLineProps) {
  const { t } = useTranslation();
  const { screen, actions } = useSongScreen();
  // Earned serif: a name reads in Lora; a recorder filename or a timestamp
  // stays in quiet tabular Jakarta.
  const titleIsEarned = !!clip.title && !isClipTitleAutoNamed(clip);

  return (
    <View style={styles.songDetailPrimaryLine} pointerEvents="box-none">
      <Press
        feel="glyph"
        haptic="tap"
        style={styles.songDetailPrimaryLinePlay}
        hitSlop={6}
        onPress={() => actions.playProjectQueue([clip.id])}
        accessibilityRole="button"
        accessibilityLabel={t("songDetail.playPrimaryTake")}
      >
        <Ionicons name="play" size={16} color={colors.textStrong} style={{ marginLeft: 2 }} />
      </Press>
      <Press
        feel="glyph"
        haptic="navigate"
        style={styles.songDetailPrimaryLineName}
        hitSlop={{ top: 8, bottom: 8 }}
        onPress={onLocate ?? (() => screen.setSongTab("takes"))}
        accessibilityRole="button"
        accessibilityLabel={t("songDetail.findPrimaryTake")}
      >
        <UserText
          value={clip.title}
          style={
            titleIsEarned
              ? styles.songDetailPrimaryLineTitleSerif
              : styles.songDetailPrimaryLineTitle
          }
          numberOfLines={1}
        >
          {clip.title || t("common.untitled")}
        </UserText>
      </Press>
      <Text style={styles.songDetailPrimaryLineLabel} numberOfLines={1}>
        {t("songDetail.primaryTake")}
      </Text>
    </View>
  );
}
