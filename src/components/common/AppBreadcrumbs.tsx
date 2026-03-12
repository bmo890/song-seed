import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getHierarchyIconColor, getHierarchyIconName, type HierarchyLevel } from "../../hierarchy";
import { styles } from "../../styles";
import { colors, spacing } from "../../design/tokens";

export type AppBreadcrumbItem = {
  key: string;
  label: string;
  level: HierarchyLevel;
  onPress?: () => void;
  active?: boolean;
  iconOnly?: boolean;
};

type Props = {
  items: AppBreadcrumbItem[];
  containerStyle?: StyleProp<ViewStyle>;
  hideIcons?: boolean;
};

export function AppBreadcrumbs({ items, containerStyle, hideIcons }: Props) {
  if (items.length === 0) return null;

  return (
    <View style={[breadcrumbStyles.row, containerStyle]}>
      {items.map((item, index) => {
        const content = (
          <View style={breadcrumbStyles.itemInner}>
            {!hideIcons && (
              <Ionicons
                name={getHierarchyIconName(item.level)}
                size={12}
                color={getHierarchyIconColor(item.level)}
              />
            )}
            {!item.iconOnly ? (
              <Text
                style={[
                  breadcrumbStyles.text,
                  item.active ? breadcrumbStyles.textActive : null,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            ) : null}
          </View>
        );

        return (
          <Fragment key={item.key}>
            {index > 0 ? (
              <Ionicons name="chevron-forward" size={12} color="#94a3b8" />
            ) : null}
            {item.onPress ? (
              <Pressable
                style={({ pressed }) => [
                  breadcrumbStyles.item,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={item.onPress}
              >
                {content}
              </Pressable>
            ) : (
              <View style={breadcrumbStyles.item}>{content}</View>
            )}
          </Fragment>
        );
      })}
    </View>
  );
}

const breadcrumbStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: 2,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  item: {
    paddingVertical: 2,
  },
  itemInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  text: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
    flexShrink: 1,
  },
  textActive: {
    color: colors.textStrong,
    fontWeight: "700",
  },
});
