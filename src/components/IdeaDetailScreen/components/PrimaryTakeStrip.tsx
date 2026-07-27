import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { type TimelineClipEntry } from "../../../domain/clipGraph";
import { useSongScreen } from "../provider/SongScreenProvider";
import { isClipTitleAutoNamed } from "../../../domain/clipPresentation";
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
  // Earned serif: only a hand-named take gets the Lora title; auto-named takes
  // (and imports still wearing their filename) stay in quiet tabular Jakarta.
  const titleIsEarned = !isClipTitleAutoNamed(clip) && !!clip.title;

  return (
    <View style={styles.songDetailPrimaryStrip}>
      <View style={styles.songDetailPrimaryStripAccent} />
      {/* Bare play glyph — same lead treatment as the clip card, no circle. */}
      <Pressable
        style={({ pressed }) => [
          styles.ideasInlinePlayBtn,
          pressed ? styles.pressDown : null,
        ]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={() => actions.playProjectQueue([clip.id])}
        accessibilityRole="button"
        accessibilityLabel={t("songDetail.playPrimaryTake")}
      >
        <Ionicons name="play" size={18} color={colors.textStrong} style={{ marginStart: 2 }} />
      </Pressable>
      <View style={styles.songDetailPrimaryStripCopy}>
        <Text style={styles.songDetailPrimaryStripLabel}>{t("songDetail.primaryTake")}</Text>
        <UserText
          value={clip.title}
          style={
            titleIsEarned
              ? styles.songDetailPrimaryStripTitleSerif
              : styles.songDetailPrimaryStripTitle
          }
          numberOfLines={1}
        >
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
        {/* "Show me where this is" — the same open-outline glyph the Queue,
            Activity, Shelf and Revisit use for view-in-context. One question,
            one icon. */}
        <Ionicons name="open-outline" size={15} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
