import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { colors, radii, shadows, text as textTokens } from "../../design/tokens";

type Props = {
    title: string;
    leftIcon?: "hamburger" | "back" | "none";
    onLeftPress?: () => void;
    rightElement?: React.ReactNode;
};

export function ScreenHeader({ title, leftIcon = "hamburger", onLeftPress, rightElement }: Props) {
    const navigation = useNavigation();

    function handleLeftPress() {
        if (onLeftPress) {
            onLeftPress();
            return;
        }
        if (leftIcon === "hamburger") {
            (navigation as any).openDrawer?.();
        } else if (leftIcon === "back") {
            navigation.goBack();
        }
    }

    return (
        <View style={headerStyles.row}>
            {leftIcon !== "none" ? (
                <Pressable
                    style={({ pressed }) => [
                        leftIcon === "hamburger" ? headerStyles.hamburgerBtn : headerStyles.backBtn,
                        pressed ? styles.pressDown : null,
                    ]}
                    onPress={handleLeftPress}
                >
                    {leftIcon === "hamburger" ? (
                        <Text style={headerStyles.hamburgerLabel}>☰</Text>
                    ) : (
                        <Text style={headerStyles.backBtnText}>Back</Text>
                    )}
                </Pressable>
            ) : (
                <View style={{ width: 44, height: 44 }} />
            )}

            <Text style={headerStyles.title}>{title}</Text>

            {rightElement ? (
                <View style={{ minWidth: 44, alignItems: "flex-end" }}>{rightElement}</View>
            ) : (
                <View style={{ width: 44, height: 44 }} />
            )}
        </View>
    );
}

const headerStyles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    hamburgerBtn: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    hamburgerLabel: {
        fontSize: 28,
        color: "#374151",
        fontWeight: "400",
    },
    backBtn: {
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        borderRadius: radii.md - 2,
        minHeight: 36,
        minWidth: 36,
        paddingHorizontal: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    backBtnText: {
        color: "#1f2937",
        fontWeight: "600",
    },
    title: textTokens.headerTitle,
});
