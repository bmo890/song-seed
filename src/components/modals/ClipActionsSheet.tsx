import React, { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { BottomSheet, type BottomSheetRef } from "../common/BottomSheet";

export type ClipActionItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

type ClipActionsSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: ClipActionItem[];
  onCancel: () => void;
};

function SheetActionRow({ label, icon, destructive = false, onPress }: ClipActionItem) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.collectionActionsOption,
        styles.clipActionsOption,
        destructive ? styles.collectionActionsOptionDestructive : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <View style={styles.collectionActionsOptionLead}>
        <Ionicons name={icon} size={16} color={destructive ? "#b91c1c" : "#334155"} />
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

export function ClipActionsSheet({
  visible,
  title,
  subtitle,
  actions,
  onCancel,
}: ClipActionsSheetProps) {
  const sheetRef = useRef<BottomSheetRef>(null);

  return (
    <BottomSheet ref={sheetRef} visible={visible} onClose={onCancel}>
      <View style={styles.clipActionsTitleBlock}>
        <Text style={styles.modalTitle}>{title}</Text>
        {subtitle ? <Text style={styles.clipActionsSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.collectionActionsOptionList, styles.clipActionsOptionList]}>
        {actions.map(({ key, ...action }) => (
          <SheetActionRow key={key} {...action} />
        ))}
        <Pressable
          style={({ pressed }) => [
            styles.collectionActionsOption,
            styles.clipActionsOption,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => sheetRef.current?.close()}
        >
          <View style={styles.collectionActionsOptionLead}>
            <Ionicons name="close-outline" size={16} color="#334155" />
            <Text style={styles.collectionActionsOptionText}>Cancel</Text>
          </View>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
