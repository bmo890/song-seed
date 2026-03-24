import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";

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
  count: number;
  actions: SelectionAction[];
  onDone: () => void;
  onLayout?: (height: number) => void;
};

export function SelectionDock({ count, actions, onDone, onLayout }: SelectionDockProps) {
  const insets = useSafeAreaInsets();
  const bottomOffset = 12 + Math.max(insets.bottom, 12);

  return (
    <View
      style={[styles.selectionDock, { bottom: bottomOffset }]}
      onLayout={(event) => onLayout?.(event.nativeEvent.layout.height)}
    >
      <View style={styles.selectionDockHeader}>
        <Text style={styles.selectionDockCount}>{count} selected</Text>
        <Pressable
          style={({ pressed }) => [styles.selectionDockDoneBtn, pressed ? styles.pressDown : null]}
          onPress={onDone}
        >
          <Text style={styles.selectionDockDoneBtnText}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.selectionDockActionsRow}>
        {actions.map((action) => {
          const dangerous = action.tone === "danger";
          return (
            <Pressable
              key={action.key}
              style={({ pressed }) => [
                styles.selectionDockAction,
                dangerous ? styles.selectionDockActionDanger : null,
                action.disabled ? styles.selectionDockActionDisabled : null,
                pressed && !action.disabled ? styles.pressDown : null,
              ]}
              disabled={action.disabled}
              onPress={action.onPress}
            >
              <Ionicons
                name={action.icon}
                size={16}
                color={dangerous ? "#b91c1c" : "#0f172a"}
              />
              <Text
                style={[
                  styles.selectionDockActionText,
                  dangerous ? styles.selectionDockActionTextDanger : null,
                ]}
                numberOfLines={1}
              >
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
