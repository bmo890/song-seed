import { Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Press } from "../../../common/Press";
import { styles } from "../../styles";
import { colors } from "../../../../design/tokens";

/**
 * The card's two small ink keys (2026-10-15), on the footer's trailing edge:
 * "+ Version" records a new version of this take, the same words on every
 * card in Evolution (a lone take and a thread's head alike); "2 older ⌄"
 * unfolds a thread's history under its card. Glyph + word, no fill.
 */
export function ClipCardVersionKey({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <Press
      feel="glyph"
      // haptics.ts: tap → any acknowledged press.
      haptic="tap"
      style={styles.songDetailCardKey}
      onPress={(event) => {
        event.stopPropagation();
        void onPress();
      }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={t("clipLineage.newVersionA11y", { title })}
    >
      <Ionicons name="add" size={15} color={colors.textStrong} />
      <Text style={styles.songDetailCardKeyText}>{t("clipLineage.versionKey")}</Text>
    </Press>
  );
}

export function ClipCardFoldKey({
  count,
  expanded,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Press
      feel="glyph"
      // haptics.ts: light → small state flips (fold/unfold).
      haptic="light"
      style={styles.songDetailCardKey}
      onPress={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 4 }}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={
        expanded
          ? t("clipLineage.hideOlderVersions", { count })
          : t("clipLineage.olderVersions", { count })
      }
    >
      <Text style={styles.songDetailCardKeyText}>{t("clipLineage.olderShort", { count })}</Text>
      <Ionicons
        name={expanded ? "chevron-up" : "chevron-down"}
        size={13}
        color={colors.textStrong}
      />
    </Press>
  );
}
