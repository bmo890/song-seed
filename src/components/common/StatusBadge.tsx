import { Text, View, StyleProp, TextStyle, ViewStyle } from "react-native";
import { styles } from "../../styles";
import { IdeaStatus } from "../../types";
import { colors } from "../../design/tokens";

type Props = {
    status: IdeaStatus;
    pct?: number | null;
    /** Dense list rows: render a small colored dot + short caps label instead of
     * the pill, so it reads as a quiet stage marker in a tight row. */
    dense?: boolean;
    style?: StyleProp<TextStyle>;
};

const DENSE_COLORS: Record<string, string> = {
    seed: colors.textMuted,
    sprout: "#7A6340",
    stem: "#7A4E2D",
    song: colors.primaryDeep,
    clip: colors.textSecondary,
};

const DENSE_LABELS: Record<string, string> = {
    seed: "SEED",
    sprout: "SPRT",
    stem: "STEM",
    song: "SONG",
    clip: "CLIP",
};

export function StatusBadge({ status, pct, dense, style }: Props) {
    if (dense) {
        const color = DENSE_COLORS[status] ?? DENSE_COLORS.clip;
        return (
            <View style={styles.statusDenseWrap}>
                <View style={[styles.statusDenseDot, { backgroundColor: color }]} />
                <Text style={[styles.statusDenseLabel, { color }]}>
                    {DENSE_LABELS[status] ?? status.toUpperCase()}
                </Text>
            </View>
        );
    }

    let viewStyle: StyleProp<ViewStyle>;
    let textStyle: StyleProp<TextStyle>;
    let label = pct != null ? `${status.toUpperCase()} ${pct}%` : status.toUpperCase();

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
            label = "SONG";
            break;
        default:
            viewStyle = styles.statusClip;
            textStyle = styles.statusClipText;
            break;
    }

    return (
        <Text style={[styles.badge, viewStyle, textStyle, style]}>
            {label}
        </Text>
    );
}
