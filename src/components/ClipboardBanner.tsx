import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";

export function ClipboardBanner({
  count,
  mode,
  actionLabel,
  disabled,
  onAction,
  onCancel,
}: {
  count: number;
  mode: "copy" | "move";
  actionLabel?: string;
  disabled?: boolean;
  onAction?: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.selectionBar}>
      <Text style={styles.selectionText}>
        {count} {mode === "move" ? "move" : "copy"} ready
      </Text>
      <View style={styles.rowButtons}>
        {actionLabel && onAction ? (
          <Pressable
            style={[styles.primaryBtn, { opacity: disabled ? 0.4 : 1 }]}
            onPress={() => {
              if (disabled) return;
              onAction();
            }}
          >
            <Text style={styles.primaryBtnText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.secondaryBtn} onPress={onCancel}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
