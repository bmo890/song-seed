import { Text, View, StyleProp, TextStyle, ViewStyle } from "react-native";
import { styles } from "../../styles";
import { IdeaStatus } from "../../types";
import { colors } from "../../design/tokens";
import { useTranslation } from "react-i18next";
import { useLocale } from "../../i18n";

type Props = {
    status: IdeaStatus;
    /** Dense list rows: render a small colored dot + short caps label instead of
     * the pill, so it reads as a quiet stage marker in a tight row. */
    dense?: boolean;
    style?: StyleProp<TextStyle>;
};

/** Canonical warm ink per stage — the single source for stage accent color
 * (dense dot, filter-chip border). Reuse this instead of cold literals. */
export const STAGE_INK: Record<string, string> = {
    seed: colors.textMuted,
    sprout: "#7A6340",
    stem: "#7A4E2D",
    song: colors.primaryDeep,
    clip: colors.textSecondary,
};

const DENSE_COLORS = STAGE_INK;

const DENSE_LABELS: Record<string, string> = {
    seed: "IDEA",
    sprout: "START",
    stem: "SHAPE",
    song: "SONG",
    clip: "CLIP",
};

export function StatusBadge({ status, dense, style }: Props) {
    const { t } = useTranslation();
    const { language } = useLocale();
    const translatedStatus = t(`stages.${status}`);
    if (dense) {
        const color = DENSE_COLORS[status] ?? DENSE_COLORS.clip;
        return (
            <View style={styles.statusDenseWrap}>
                <View style={[styles.statusDenseDot, { backgroundColor: color }]} />
                <Text style={[styles.statusDenseLabel, { color }]}>
                    {language === "en" ? DENSE_LABELS[status] ?? status.toUpperCase() : translatedStatus}
                </Text>
            </View>
        );
    }

    let viewStyle: StyleProp<ViewStyle>;
    let textStyle: StyleProp<TextStyle>;

    switch (status) {
        case "seed":
            viewStyle = styles.statusSeed;
            textStyle = styles.statusSeedText;
            break;
        case "sprout":
            viewStyle = styles.statusSprout;
            textStyle = styles.statusSproutText;
            break;
        case "stem":
            viewStyle = styles.statusStem;
            textStyle = styles.statusStemText;
            break;
        case "song":
            viewStyle = styles.statusSong;
            textStyle = styles.statusSongText;
            break;
        default:
            viewStyle = styles.statusClip;
            textStyle = styles.statusClipText;
            break;
    }

    return (
        <Text style={[styles.badge, viewStyle, textStyle, style]}>
            {translatedStatus}
        </Text>
    );
}
