import { useEffect, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../design/directionalIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { haptic } from "../../design/haptics";
import { colors } from "../../design/tokens";

export type SelectionActionTone = "default" | "danger";

export type SelectionAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Composite glyph override for the dock (the plain `icon` stays the fallback,
   *  e.g. when the same action is listed in the overflow sheet). */
  renderIcon?: (props: { color: string; size: number; disabled: boolean }) => ReactNode;
  onPress: () => void;
  tone?: SelectionActionTone;
  disabled?: boolean;
  /** Keep the glyph pointing the same way under RTL — for actions inside a
   *  surface that itself stays LTR, e.g. "add bar before/after" on the chord
   *  staff, where before really does mean to the left. */
  noMirror?: boolean;
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
              onPress={() => {
                haptic.tap();
                action.onPress();
              }}
            >
              {(() => {
                // IconButton tone ladder: muted utility glyphs, danger stays red.
                const iconColor = action.disabled
                  ? colors.textMuted
                  : dangerous
                  ? colors.danger
                  : colors.textSecondary;
                return action.renderIcon
                  ? action.renderIcon({ color: iconColor, size: 20, disabled: !!action.disabled })
                  : <Ionicons name={action.noMirror ? action.icon : dirIcon(action.icon)} size={20} color={iconColor} />;
              })()}
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
