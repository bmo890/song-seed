import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../design/directionalIcons";
import { BottomSheet } from "./BottomSheet";
import { styles } from "../../styles";
import type { SelectionAction } from "./SelectionDock";
import { haptic } from "../../design/haptics";
import { colors, spacing, text as textTokens } from "../../design/tokens";
import { useTranslation } from "react-i18next";

type SelectionActionSheetProps = {
  visible: boolean;
  title?: string;
  actions: SelectionAction[];
  onClose: () => void;
  /** A second-level sheet names its parent: the back key closes this sheet and
   *  reopens that one, so drilling in is never a one-way door. */
  onBack?: () => void;
  /** One line under the title saying what the choice is about ("A sketch:
   *  3 takes · lyrics · notes"). */
  subtitle?: string;
};

export function SelectionActionSheet({
  visible,
  title,
  actions,
  onClose,
  onBack,
  subtitle,
}: SelectionActionSheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.selectionSheetHeader}>
        {onBack ? (
          <Pressable
            style={({ pressed }) => [styles.selectionSheetBack, pressed ? styles.pressDown : null]}
            onPress={() => {
              haptic.tap();
              onClose();
              onBack();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name={dirIcon("chevron-back")} size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        <Text style={styles.selectionSheetTitle}>{title ?? t("common.selectionActions")}</Text>
      </View>
      {subtitle ? <Text style={sheetLocal.subtitle}>{subtitle}</Text> : null}
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
                  name={action.noMirror ? action.icon : dirIcon(action.icon)}
                  size={16}
                  color={dangerous ? colors.danger : colors.textSecondary}
                />
                <View style={sheetLocal.labelBlock}>
                  <Text
                    style={[
                      styles.selectionSheetActionText,
                      dangerous ? styles.selectionSheetActionTextDanger : null,
                    ]}
                  >
                    {action.label}
                  </Text>
                  {action.hint ? <Text style={sheetLocal.hint}>{action.hint}</Text> : null}
                </View>
              </View>
              {/* Only a row that opens somewhere else points onward. */}
              {dangerous ? (
                <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
              ) : action.opens ? (
                <Ionicons name={dirIcon("chevron-forward")} size={15} color={colors.textMuted} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const sheetLocal = StyleSheet.create({
  subtitle: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  labelBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  hint: {
    ...textTokens.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textMuted,
  },
});
