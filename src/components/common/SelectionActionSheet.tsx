import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../design/directionalIcons";
import { BottomSheet } from "./BottomSheet";
import { styles } from "../../styles";
import type { SelectionAction } from "./SelectionDock";
import { actionMenuStore, type ActionMenuConfig } from "./actionMenuStore";
import { haptic } from "../../design/haptics";
import { colors, spacing, text as textTokens } from "../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserText } from "../../i18n";

type SelectionActionSheetProps = {
  visible: boolean;
  title?: string;
  /** Quiet words beside the title naming what the sheet acts on ("Idea 8"). */
  titleContext?: string;
  actions: SelectionAction[];
  onClose: () => void;
  /** Runs (after onClose) only when the sheet is dismissed without a choice:
   *  scrim, grabber, back. A row runs onClose and then its own action. */
  onCancel?: () => void;
  /** A second-level sheet names its parent: the back key closes this sheet and
   *  reopens that one, so drilling in is never a one-way door. */
  onBack?: () => void;
  /** One line under the title saying what the choice is about ("A sketch:
   *  3 takes · lyrics · notes"). */
  subtitle?: string;
};

/**
 * Every action menu in the app (2026-10-15, founder picked "rows on paper"):
 * a glyph and a word per row, hairlines between, a chevron only on a row that
 * opens more. No boxes. Destructive rows always come last, in danger ink,
 * after a hairline of their own, whatever order the caller passed.
 *
 * Order rule for callers (industry order, docs/design-system.md): act on the
 * thing (play, edit, make primary) → organise it (versions, tags, group,
 * playlist, copy or move, shelf) → go somewhere (view in collection) → send
 * it out (share, export) → destroy.
 */
export function SelectionActionSheet({
  visible,
  title,
  titleContext,
  actions,
  onClose,
  onCancel,
  onBack,
  subtitle,
}: SelectionActionSheetProps) {
  const { t } = useTranslation();
  const safe = actions.filter((action) => action.tone !== "danger");
  const danger = actions.filter((action) => action.tone === "danger");
  const renderRow = (action: SelectionAction, last: boolean) => {
    const dangerous = action.tone === "danger";
    return (
      <Pressable
        key={action.key}
        style={({ pressed }) => [
          sheetLocal.row,
          action.disabled ? sheetLocal.disabled : null,
          pressed && !action.disabled ? styles.pressDown : null,
        ]}
        disabled={action.disabled}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        accessibilityState={action.selected != null ? { selected: action.selected } : undefined}
        onPress={() => {
          haptic.tap();
          onClose();
          action.onPress();
        }}
      >
        <Ionicons
          name={action.noMirror ? action.icon : dirIcon(action.icon)}
          size={20}
          color={dangerous ? colors.danger : action.selected ? colors.primary : colors.textStrong}
        />
        <View style={[sheetLocal.rowBody, last ? null : sheetLocal.rowRule]}>
          <View style={sheetLocal.labelBlock}>
            <Text
              style={[
                sheetLocal.label,
                dangerous ? sheetLocal.labelDanger : null,
                action.selected ? sheetLocal.labelSelected : null,
              ]}
            >
              {action.label}
            </Text>
            {action.hint ? <Text style={sheetLocal.hint}>{action.hint}</Text> : null}
          </View>
          {/* Only a row that opens somewhere else points onward. */}
          {action.opens ? (
            <Ionicons name={dirIcon("chevron-forward")} size={16} color={colors.textMuted} />
          ) : null}
        </View>
      </Pressable>
    );
  };
  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        onClose();
        onCancel?.();
      }}
    >
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
        <Text style={styles.selectionSheetTitle} numberOfLines={1}>
          {title ?? t("common.selectionActions")}
        </Text>
        {titleContext ? (
          <UserText value={titleContext} style={sheetLocal.titleContext} numberOfLines={1}>
            {titleContext}
          </UserText>
        ) : null}
      </View>
      {subtitle ? <Text style={sheetLocal.subtitle}>{subtitle}</Text> : null}
      <View>
        {safe.map((action, index) => renderRow(action, index === safe.length - 1))}
      </View>
      {danger.length > 0 ? (
        <View style={safe.length > 0 ? sheetLocal.dangerGroup : null}>
          {danger.map((action, index) => renderRow(action, index === danger.length - 1))}
        </View>
      ) : null}
    </BottomSheet>
  );
}

/** Draws `AppAlert.menu` / `actionMenuStore`: one per app, near the root. A
 *  row that opens a second menu shows it in the same sheet. */
export function ActionMenuHost() {
  const [config, setConfig] = useState<ActionMenuConfig | null>(null);
  useEffect(() => actionMenuStore.subscribe(setConfig), []);
  return (
    <SelectionActionSheet
      visible={!!config}
      title={config?.title}
      titleContext={config?.titleContext}
      actions={config?.actions ?? []}
      onClose={() => {
        const onDismiss = config?.onDismiss;
        actionMenuStore.dismiss();
        // A chosen row closes the sheet first, then runs: let it land before
        // telling the caller nothing was chosen.
        if (onDismiss) queueMicrotask(onDismiss);
      }}
    />
  );
}

const sheetLocal = StyleSheet.create({
  subtitle: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  titleContext: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 52,
  },
  rowBody: {
    flex: 1,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  labelBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 16,
    color: colors.textPrimary,
  },
  labelDanger: {
    color: colors.danger,
  },
  labelSelected: {
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  hint: {
    ...textTokens.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textMuted,
  },
  disabled: {
    opacity: 0.4,
  },
  // Destruction stands apart: its own hairline above it.
  dangerGroup: {
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
});
