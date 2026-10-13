import React, { useRef } from "react";
import { Text, View } from "react-native";
import { Press } from "../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { BottomSheet, type BottomSheetRef } from "../common/BottomSheet";
import { colors } from "../../design/tokens";
import { useTranslation } from "react-i18next";

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
    <Press
      haptic="none"
      style={[styles.collectionActionsOption,
        styles.clipActionsOption,
        destructive ? styles.collectionActionsOptionDestructive : null]}
      onPress={onPress}
    >
      <View style={styles.collectionActionsOptionLead}>
        <Ionicons name={icon} size={16} color={destructive ? colors.danger : colors.textStrong} />
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
        color={destructive ? colors.danger : colors.textMuted}
      />
    </Press>
  );
}

export function ClipActionsSheet({
  visible,
  title,
  subtitle,
  actions,
  onCancel,
}: ClipActionsSheetProps) {
  const { t } = useTranslation();
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
        <Press
          haptic="none"
          style={[styles.collectionActionsOption,
            styles.clipActionsOption]}
          onPress={() => sheetRef.current?.close()}
        >
          <View style={styles.collectionActionsOptionLead}>
            <Ionicons name="close-outline" size={16} color={colors.textStrong} />
            <Text style={styles.collectionActionsOptionText}>{t("common.cancel")}</Text>
          </View>
        </Press>
      </View>
    </BottomSheet>
  );
}
