import { Text, View } from "react-native";
import { styles } from "../styles";
import { Button } from "./common/Button";
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
          <Button label={actionLabel} disabled={disabled} onPress={onAction} />
        ) : null}
        <Button variant="secondary" label={t("common.cancel")} onPress={onCancel} />
      </View>
    </View>
  );
}
