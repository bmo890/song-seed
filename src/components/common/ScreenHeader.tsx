import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { colors, text as textTokens } from "../../design/tokens";
import { useTranslation } from "react-i18next";
import { dirIcon } from "../../design/directionalIcons";
import { useOriginLabel } from "../../hooks/useOriginLabel";

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
    const { t } = useTranslation();
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
    // Back wears the name of where it lands (navigation law 2026-09-16) — the
    // route beneath this page in its stack. Pages that only switch an internal
    // view (Settings, Compilations) live in the drawer and get the bare chevron.
    const originLabel = useOriginLabel(effectiveLeftIcon === "back");

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
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={
                        effectiveLeftIcon === "hamburger"
                            ? t("workspaceBrowse.openMenu")
                            : originLabel
                              ? t("common.backTo", { label: originLabel })
                              : t("common.back")
                    }
                >
                    {effectiveLeftIcon === "hamburger" ? (
                        <Ionicons name="menu-outline" size={22} color={colors.textStrong} />
                    ) : (
                        <>
                            {/* Same grammar as the sketch and visited-collection nav rows:
                                chevron + the origin's name, no pill. */}
                            <Ionicons name={dirIcon("chevron-back")} size={22} color={colors.textStrong} />
                            {originLabel ? (
                                <Text style={headerStyles.backLabel} numberOfLines={1}>
                                    {originLabel}
                                </Text>
                            ) : null}
                        </>
                    )}
                </Pressable>
            ) : (
                <View style={{ width: 44, height: 44 }} />
            )}

            <Text style={headerStyles.title} numberOfLines={1}>
                {title}
            </Text>

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
        gap: 6,
        minHeight: 44,
        minWidth: 44,
        // Room for a name, never for a sentence — the title keeps the row.
        maxWidth: "38%",
        paddingEnd: 4,
    },
    backLabel: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 11,
        lineHeight: 16,
        color: colors.eyebrow,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        flexShrink: 1,
    },
    title: {
        ...textTokens.headerTitle,
        // RN Text defaults to flexShrink 0 — a long title otherwise overlaps the back
        // pill instead of truncating.
        flexShrink: 1,
        marginHorizontal: 8,
    },
});
