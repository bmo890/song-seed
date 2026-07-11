import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { styles } from "../../styles";
import type { SelectionAction } from "./SelectionDock";
import { haptic } from "../../design/haptics";
import { colors } from "../../design/tokens";

type SelectionActionSheetProps = {
  visible: boolean;
  title?: string;
  actions: SelectionAction[];
  onClose: () => void;
};

export function SelectionActionSheet({
  visible,
  title = "Selection actions",
  actions,
  onClose,
}: SelectionActionSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.selectionSheetTitle}>{title}</Text>
      <View style={styles.selectionSheetActionList}>
        {actions.map((action) => {
          const dangerous = action.tone === "danger";
          return (
            <Pressable
              key={action.key}
              style={({ pressed }) => [
                styles.selectionSheetAction,
                dangerous ? styles.selectionSheetActionDanger : null,
                action.disabled ? styles.selectionToolbarActionDisabled : null,
                pressed && !action.disabled ? styles.pressDown : null,
              ]}
              disabled={action.disabled}
              onPress={() => {
                haptic.tap();
                onClose();
                action.onPress();
              }}
            >
              <View style={styles.selectionSheetActionLead}>
                <Ionicons
                  name={action.icon}
                  size={16}
                  color={dangerous ? colors.danger : "#334155"}
                />
                <Text
                  style={[
                    styles.selectionSheetActionText,
                    dangerous ? styles.selectionSheetActionTextDanger : null,
                  ]}
                >
                  {action.label}
                </Text>
              </View>
              <Ionicons
                name={dangerous ? "alert-circle-outline" : "chevron-forward"}
                size={15}
                color={dangerous ? colors.danger : "#94a3b8"}
              />
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
