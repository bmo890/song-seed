import { Pressable, Text, PressableProps, StyleProp, ViewStyle, TextStyle } from "react-native";
import { styles } from "../../styles";
import { haptic } from "../../design/haptics";

type Props = PressableProps & {
    label: string;
    variant?: "primary" | "secondary";
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    /** Buttons tick by default; pass false for presses that already buzz elsewhere. */
    hapticFeedback?: boolean;
};

export function Button({ label, variant = "primary", style, textStyle, disabled, hapticFeedback = true, onPress, ...rest }: Props) {
    const isSecondary = variant === "secondary";

    return (
        <Pressable
            style={({ pressed }) => [
                isSecondary ? styles.secondaryBtn : styles.primaryBtn,
                disabled ? styles.btnDisabled : null,
                pressed && !disabled ? styles.pressDown : null,
                style,
            ]}
            disabled={disabled}
            onPress={(event) => {
                if (hapticFeedback) haptic.tap();
                onPress?.(event);
            }}
            {...rest}
        >
            <Text style={[isSecondary ? styles.secondaryBtnText : styles.primaryBtnText, textStyle]}>
                {label}
            </Text>
        </Pressable>
    );
}
