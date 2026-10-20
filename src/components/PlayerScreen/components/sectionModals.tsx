import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../design/tokens";
import { getSectionPreset, nearestSectionInk, SECTION_INKS, SECTION_QUICK_ADD, sectionPresetDisplayLabel } from "../../../domain/playerSections";
import type { SectionCustomInput } from "../hooks/usePlayerSections";
import { WarmModal } from "../../common/WarmModal";
import { playerScreenStyles as s } from "../styles";
import type { ClipSectionKind } from "../../../types";
import { useTranslation } from "react-i18next";
import { UserText, UserTextInput } from "../../../i18n";
import { ModalDialogLayer } from "../../common/AppDialog";
import { ModalGestureRoot } from "../../common/ModalGestureRoot";

export function SectionPickerModal({
  visible,
  title,
  customOptions,
  onPickPreset,
  onPickCustom,
  onCreateNew,
  onClose,
}: {
  visible: boolean;
  title: string;
  customOptions: { label: string; color: string }[];
  onPickPreset: (kind: ClipSectionKind) => void;
  onPickCustom: (custom: SectionCustomInput) => void;
  onCreateNew: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <ModalGestureRoot>
        <Pressable style={s.sectionModalBackdrop} onPress={onClose}>
          <Pressable style={s.sectionModalCard} onPress={() => {}}>
            <Text style={s.sectionModalTitle}>{title}</Text>
            <View style={s.sectionModalGrid}>
              {SECTION_QUICK_ADD.map((kind) => {
                const preset = getSectionPreset(kind);
                return (
                  <Pressable
                    key={kind}
                    style={s.sectionChip}
                    onPress={() => onPickPreset(kind)}
                    accessibilityRole="button"
                    accessibilityLabel={sectionPresetDisplayLabel(kind)}
                  >
                    <View style={[s.sectionSwatch, { backgroundColor: preset.color }]} />
                    <Text style={s.sectionChipText}>
                      {sectionPresetDisplayLabel(kind)}
                    </Text>
                  </Pressable>
                );
              })}
              {customOptions.map((option) => (
                <Pressable
                  key={`custom-${option.label}`}
                  style={s.sectionChip}
                  onPress={() => onPickCustom(option)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                >
                  <View style={[s.sectionSwatch, { backgroundColor: option.color }]} />
                  <Text style={s.sectionChipText}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.sectionPickerFooter}>
              <Pressable
                style={s.sectionModalNewButton}
                onPress={onCreateNew}
                accessibilityRole="button"
                accessibilityLabel={t("player.customSectionA11y")}
              >
                <Ionicons name="add" size={16} color={colors.primaryDeep} />
                <Text style={s.sectionModalNewText}>{t("player.newCustom")}</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable style={s.sectionModalCancel} onPress={onClose} accessibilityRole="button">
                <Text style={s.sectionModalCancelText}>{t("common.cancel")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
        <ModalDialogLayer active={visible} />
      </ModalGestureRoot>
    </Modal>
  );
}

/** Title + ink editor used both for "new custom section" and editing an existing one.
 *  The ink is a choice of THREE (colors.markLight/Mid/Deep), not a hue — a section says how
 *  loud a part is, and a full-spectrum slider in a quiet sketchbook was the loudest control
 *  in the app (docs/product-plan/full-player-audit.md B2). */
export function SectionDetailModal({
  visible,
  title,
  confirmLabel,
  initialName,
  initialColor,
  onConfirm,
  onDelete,
  onClose,
}: {
  visible: boolean;
  title: string;
  confirmLabel: string;
  initialName: string;
  initialColor: string;
  onConfirm: (custom: SectionCustomInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [ink, setInk] = useState<string>(() => nearestSectionInk(initialColor));
  const prevVisible = React.useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setName(initialName);
      setInk(nearestSectionInk(initialColor));
    }
    prevVisible.current = visible;
  }, [visible, initialName, initialColor]);

  const accentColor = ink;
  const trimmed = name.trim();
  return (
    <WarmModal visible={visible} onRequestClose={onClose} title={title}>
      <View style={s.sectionDetailPreviewRow}>
        <View style={[s.sectionDetailSwatch, { backgroundColor: accentColor }]} />
        <UserText value={trimmed} style={s.sectionDetailPreviewText} numberOfLines={1}>
          {trimmed || t("player.sectionName")}
        </UserText>
      </View>
      <View style={s.sectionInkRow}>
        {SECTION_INKS.map((option) => (
          <Pressable
            key={option}
            style={[s.sectionInkSwatch, option === ink ? s.sectionInkSwatchActive : null]}
            onPress={() => setInk(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: option === ink }}
            accessibilityLabel={t("player.sectionInk")}
          >
            <View style={[s.sectionInkFill, { backgroundColor: option }]} />
          </Pressable>
        ))}
      </View>
      <UserTextInput
        style={s.sectionEditInput}
        value={name}
        onChangeText={setName}
        placeholder={t("player.sectionName")}
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        onSubmitEditing={() => trimmed && onConfirm({ label: trimmed, color: accentColor })}
      />
      <View style={s.sectionModalActions}>
        {onDelete ? (
          <Pressable
            style={s.sectionModalDelete}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={t("player.deleteSection")}
          >
            <Ionicons name="trash-outline" size={17} color={colors.danger} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable style={s.sectionModalCancel} onPress={onClose} accessibilityRole="button">
          <Text style={s.sectionModalCancelText}>{t("common.cancel")}</Text>
        </Pressable>
        <Pressable
          style={[s.sectionModalConfirm, !trimmed ? s.sectionModalConfirmDisabled : null]}
          onPress={() => trimmed && onConfirm({ label: trimmed, color: accentColor })}
          disabled={!trimmed}
          accessibilityRole="button"
        >
          <Text style={s.sectionModalConfirmText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </WarmModal>
  );
}
