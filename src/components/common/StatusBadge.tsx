import { Text, StyleProp, TextStyle, ViewStyle } from "react-native";
import { styles } from "../../styles";
import { IdeaStatus } from "../../types";

type Props = {
    status: IdeaStatus;
    pct?: number | null;
    style?: StyleProp<TextStyle>;
};

export function StatusBadge({ status, pct, style }: Props) {
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
