import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { colors } from "../../design/tokens";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  title: string;
  onRename: () => void;
  onCopy: () => void;
  onMove: () => void;
  onDelete: () => void;
  onCancel: () => void;
};

type ActionRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

function ActionRow({ icon, label, destructive = false, onPress }: ActionRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.collectionActionsOption,
        destructive ? styles.collectionActionsOptionDestructive : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <View style={styles.collectionActionsOptionLead}>
        <Ionicons
          name={icon}
          size={16}
          color={destructive ? colors.danger : "#334155"}
        />
        <Text
          style={[
            styles.collectionActionsOptionText,
            destructive ? styles.collectionActionsOptionTextDestructive : null,
          ]}
        >
          {label}
        </Text>
      </View>
      <Ionicons
        name={destructive ? "alert-circle-outline" : "chevron-forward"}
        size={15}
        color={destructive ? colors.danger : "#94a3b8"}
      />
    </Pressable>
  );
}

export function CollectionActionsModal({
  visible,
  title,
  onRename,
  onCopy,
  onMove,
  onDelete,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.overlay} onPress={onCancel}>
          <Pressable style={[styles.modalCard, styles.collectionActionsModalCard]} onPress={() => {}}>
            <Text style={styles.modalTitle}>{title}</Text>
            <View style={styles.collectionActionsOptionList}>
              <ActionRow icon="create-outline" label={t("modals.rename")} onPress={onRename} />
              <ActionRow icon="copy-outline" label={t("common.copy")} onPress={onCopy} />
              <ActionRow icon="swap-horizontal-outline" label={t("modals.move")} onPress={onMove} />
              <ActionRow icon="trash-outline" label={t("common.delete")} destructive onPress={onDelete} />
            </View>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
}
