import { Fragment } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getHierarchyIconColor, getHierarchyIconName, type HierarchyLevel } from "../../hierarchy";
import { styles } from "../../styles";

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
};

export function AppBreadcrumbs({ items, containerStyle }: Props) {
  if (items.length === 0) return null;

  return (
    <View style={[styles.appBreadcrumbRow, containerStyle]}>
      {items.map((item, index) => {
        const content = (
          <View style={styles.appBreadcrumbItemInner}>
            <Ionicons
              name={getHierarchyIconName(item.level)}
              size={12}
              color={getHierarchyIconColor(item.level)}
            />
            {!item.iconOnly ? (
              <Text
                style={[
                  styles.appBreadcrumbText,
                  item.active ? styles.appBreadcrumbTextActive : null,
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
                  styles.appBreadcrumbItem,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={item.onPress}
              >
                {content}
              </Pressable>
            ) : (
              <View style={styles.appBreadcrumbItem}>{content}</View>
            )}
          </Fragment>
        );
      })}
    </View>
  );
}
