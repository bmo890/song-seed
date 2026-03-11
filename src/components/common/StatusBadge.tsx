import { Text, StyleProp, TextStyle, ViewStyle } from "react-native";
import { styles } from "../../styles";
import { IdeaStatus } from "../../types";

type Props = {
    status: IdeaStatus;
    style?: StyleProp<TextStyle>;
};

export function StatusBadge({ status, style }: Props) {
    let viewStyle: StyleProp<ViewStyle>;
    let textStyle: StyleProp<TextStyle>;
    let label = status.toUpperCase();

    switch (status) {
        case "seed":
            viewStyle = styles.statusSeed;
            textStyle = styles.statusSeedText;
            break;
        case "sprout":
            viewStyle = styles.statusSprout;
            textStyle = styles.statusSproutText;
            break;
        case "semi":
            viewStyle = styles.statusSemi;
            textStyle = styles.statusSemiText;
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
