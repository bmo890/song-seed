import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { colors, radii, text as textTokens } from "../../design/tokens";

type Props = {
    title: string;
    leftIcon?: "hamburger" | "back" | "none";
    onLeftPress?: () => void;
    rightElement?: React.ReactNode;
};

export function ScreenHeader({
    title,
    leftIcon = "hamburger",
    onLeftPress,
    rightElement,
}: Props) {
    const navigation = useNavigation();

    function getDrawerNavigation() {
        let currentNavigation: any = navigation;
        while (currentNavigation) {
            if (typeof currentNavigation.openDrawer === "function") {
                return currentNavigation;
            }
            currentNavigation = currentNavigation.getParent?.();
        }
        return null;
    }

    const drawerNavigation = getDrawerNavigation();
    const effectiveLeftIcon =
        leftIcon === "hamburger" && !drawerNavigation && navigation.canGoBack()
            ? "back"
            : leftIcon;

    function handleLeftPress() {
        if (onLeftPress) {
            onLeftPress();
            return;
        }
        if (effectiveLeftIcon === "hamburger") {
            drawerNavigation?.openDrawer();
        } else if (effectiveLeftIcon === "back") {
            navigation.goBack();
        }
    }

    return (
        <View style={headerStyles.row}>
            {leftIcon !== "none" ? (
                <Pressable
                    style={({ pressed }) => [
                        effectiveLeftIcon === "hamburger" ? headerStyles.hamburgerBtn : headerStyles.backBtn,
                        pressed ? styles.pressDown : null,
                    ]}
                    onPress={handleLeftPress}
                >
                    {effectiveLeftIcon === "hamburger" ? (
                        <Ionicons name="menu-outline" size={22} color={colors.textStrong} />
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
    backBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 36,
        paddingHorizontal: 14,
        borderRadius: radii.round,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.surface,
    },
    backBtnText: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 14,
        color: colors.textStrong,
    },
    title: textTokens.headerTitle,
});
