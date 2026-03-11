import { Pressable, Text, PressableProps, StyleProp, ViewStyle, TextStyle } from "react-native";
import { styles } from "../../styles";

type Props = PressableProps & {
    label: string;
    variant?: "primary" | "secondary";
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
};

export function Button({ label, variant = "primary", style, textStyle, disabled, ...rest }: Props) {
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
            {...rest}
        >
            <Text style={[isSecondary ? styles.secondaryBtnText : styles.primaryBtnText, textStyle]}>
                {label}
            </Text>
        </Pressable>
    );
}
