import { Pressable, Text, PressableProps, StyleProp, ViewStyle, TextStyle } from "react-native";
import { styles } from "../../styles";
import { haptic } from "../../design/haptics";

type Variant =
    | "primary"
    | "primary-emphasis"
    | "secondary"
    | "destructive"
    | "destructive-soft"
    | "quiet";

type Props = PressableProps & {
    label: string;
    variant?: Variant;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    /** Buttons tick by default; pass false for presses that already buzz elsewhere. */
    hapticFeedback?: boolean;
};

// Button language (locked 2026-07-24): color carries tier, all soft keys at r8.
const VARIANT_STYLES: Record<Variant, { container: ViewStyle; text: TextStyle }> = {
    primary: { container: styles.primaryBtn, text: styles.primaryBtnText },
    "primary-emphasis": { container: styles.primaryEmphasisBtn, text: styles.primaryEmphasisBtnText },
    secondary: { container: styles.secondaryBtn, text: styles.secondaryBtnText },
    destructive: { container: styles.destructiveBtn, text: styles.destructiveBtnText },
    "destructive-soft": { container: styles.destructiveSoftBtn, text: styles.destructiveSoftBtnText },
    quiet: { container: styles.quietBtn, text: styles.quietBtnText },
};

export function Button({ label, variant = "primary", style, textStyle, disabled, hapticFeedback = true, onPress, ...rest }: Props) {
    const variantStyle = VARIANT_STYLES[variant];

    return (
        <Pressable
            style={({ pressed }) => [
                variantStyle.container,
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
            <Text style={[variantStyle.text, textStyle]}>
                {label}
            </Text>
        </Pressable>
    );
}
