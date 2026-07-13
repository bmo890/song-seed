import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii } from "../../design/tokens";

/**
 * Small "PRO" chip — terracotta outline on paper. Marks an affordance that is (or will be,
 * once billing lands) Pro-gated. Purely presentational.
 */
export function ProBadge({ style }: { style?: StyleProp<ViewStyle> }) {
    return (
        <View style={[styles.badge, style]}>
            <Text style={styles.label}>PRO</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: radii.md,
        paddingHorizontal: 6,
        paddingVertical: 1,
        alignSelf: "flex-start",
    },
    label: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 9,
        letterSpacing: 1.2,
        color: colors.primaryDeep,
    },
});
