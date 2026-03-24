import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";

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
          color={destructive ? "#b91c1c" : "#334155"}
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
        color={destructive ? "#b91c1c" : "#94a3b8"}
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.overlay} onPress={onCancel}>
          <Pressable style={[styles.modalCard, styles.collectionActionsModalCard]} onPress={() => {}}>
            <Text style={styles.modalTitle}>{title}</Text>
            <View style={styles.collectionActionsOptionList}>
              <ActionRow icon="create-outline" label="Rename" onPress={onRename} />
              <ActionRow icon="copy-outline" label="Copy" onPress={onCopy} />
              <ActionRow icon="swap-horizontal-outline" label="Move" onPress={onMove} />
              <ActionRow icon="trash-outline" label="Delete" destructive onPress={onDelete} />
            </View>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
}
