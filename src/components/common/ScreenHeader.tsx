import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";

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
        <View style={styles.headerRow}>
            {leftIcon !== "none" ? (
                <Pressable
                    style={({ pressed }) => [
                        leftIcon === "hamburger" ? styles.hamburgerBtn : styles.backBtn,
                        pressed ? styles.pressDown : null,
                    ]}
                    onPress={handleLeftPress}
                >
                    {leftIcon === "hamburger" ? (
                        <Text style={styles.sideNavLabel}>☰</Text>
                    ) : (
                        <Text style={styles.backBtnText}>Back</Text>
                    )}
                </Pressable>
            ) : (
                <View style={{ width: 44, height: 44 }} />
            )}

            <Text style={styles.title}>{title}</Text>

            {rightElement ? (
                <View style={{ minWidth: 44, alignItems: "flex-end" }}>{rightElement}</View>
            ) : (
                <View style={{ width: 44, height: 44 }} />
            )}
        </View>
    );
}
