import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";

export type SelectionActionTone = "default" | "danger";

export type SelectionAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: SelectionActionTone;
  disabled?: boolean;
};

type SelectionDockProps = {
  actions: SelectionAction[];
  onLayout?: (height: number) => void;
};

export function SelectionDock({ actions, onLayout }: SelectionDockProps) {
  const insets = useSafeAreaInsets();

  // Publish height so GlobalMediaDock can sit above us; clear on unmount.
  useEffect(() => {
    return () => {
      useStore.getState().setActiveSelectionDockHeight(0);
    };
  }, []);

  return (
    <Animated.View
      style={[styles.selectionToolbar, { paddingBottom: Math.max(insets.bottom, 6) }]}
      entering={SlideInDown.duration(220)}
      exiting={SlideOutDown.duration(180)}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        onLayout?.(h);
        useStore.getState().setActiveSelectionDockHeight(h);
      }}
    >
      <View style={styles.selectionToolbarActions}>
        {actions.map((action) => {
          const dangerous = action.tone === "danger";
          return (
            <Pressable
              key={action.key}
              style={({ pressed }) => [
                styles.selectionToolbarAction,
                action.disabled ? styles.selectionToolbarActionDisabled : null,
                pressed && !action.disabled ? styles.pressDown : null,
              ]}
              disabled={action.disabled}
              onPress={action.onPress}
            >
              <Ionicons
                name={action.icon}
                size={20}
                color={
                  action.disabled
                    ? "#c4b8b4"
                    : dangerous
                    ? "#a83232"
                    : "#524440"
                }
              />
              <Text
                style={[
                  styles.selectionToolbarActionLabel,
                  dangerous ? styles.selectionToolbarActionLabelDanger : null,
                  action.disabled ? styles.selectionToolbarActionLabelDisabled : null,
                ]}
                numberOfLines={1}
              >
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}
