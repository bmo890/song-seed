import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { styles } from "../../styles";
import type { SelectionAction } from "./SelectionDock";

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
                action.disabled ? styles.selectionDockActionDisabled : null,
                pressed && !action.disabled ? styles.pressDown : null,
              ]}
              disabled={action.disabled}
              onPress={() => {
                onClose();
                action.onPress();
              }}
            >
              <View style={styles.selectionSheetActionLead}>
                <Ionicons
                  name={action.icon}
                  size={16}
                  color={dangerous ? "#b91c1c" : "#334155"}
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
                color={dangerous ? "#b91c1c" : "#94a3b8"}
              />
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
