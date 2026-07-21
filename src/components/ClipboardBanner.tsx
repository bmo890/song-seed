import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  return (
    <View style={styles.selectionBar}>
      <Text style={styles.selectionText}>
        {t(mode === "move" ? "common.moveReady" : "common.copyReady", { count })}
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
          <Text style={styles.secondaryBtnText}>{t("common.cancel")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
