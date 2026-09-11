import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { styles } from "../../styles";
import { colors, spacing, text as textTokens } from "../../design/tokens";
import { riseIn, riseOut } from "../../design/motion";
import { useStore } from "../../state/useStore";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

type PickerFooterProps = {
  /** ✕ — leave the picker, keeping nothing. */
  onCancel: () => void;
  cancelLabel: string;
  /** How many are picked on this page. Drives the Add key's label. */
  count?: number;
  /** The commit. Omit on pages that only host the picker (the hub): ✕ alone. */
  onAdd?: () => void;
  /** Quiet guidance beside ✕ when there is nothing to commit here. */
  supportingText?: string;
  onLayout?: (height: number) => void;
};

/**
 * The ONE chrome of a picking session (canon, 2026-09-11) — a sticky footer
 * where the selection dock sits: ✕ on the left, the primary "Add N" soft key
 * on the right. Replaces the banner + selection top bar + dock trio that used
 * to appear together while a compilation was collecting.
 *
 * Publishes its height the same way SelectionDock does, so the media dock
 * lifts above it and list footers clear it.
 */
export function PickerFooter({ onCancel, cancelLabel, count = 0, onAdd, supportingText, onLayout }: PickerFooterProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    return () => {
      useStore.getState().setActiveSelectionDockHeight(0);
    };
  }, []);

  return (
    <Animated.View
      testID="picker-footer"
      style={[styles.selectionToolbar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      entering={riseIn}
      exiting={riseOut}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        onLayout?.(h);
        useStore.getState().setActiveSelectionDockHeight(h);
      }}
    >
      <View style={s.row}>
        {/* IconButton ticks on press — haptics vocabulary: `tap`. */}
        <IconButton
          testID="picker-footer-cancel"
          icon="close"
          tone="muted"
          size={22}
          onPress={onCancel}
          accessibilityLabel={cancelLabel}
        />
        {supportingText ? (
          <Text style={s.supporting} numberOfLines={1}>
            {supportingText}
          </Text>
        ) : (
          <View style={s.spacer} />
        )}
        {onAdd ? (
          // Button ticks on press — haptics vocabulary: `tap`.
          <Button
            testID="picker-footer-add"
            variant="primary"
            label={count > 0 ? t("selection.addCount", { count }) : t("selection.add")}
            disabled={count === 0}
            onPress={onAdd}
            style={s.addKey}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    minHeight: 38 + spacing.md,
  },
  spacer: {
    flex: 1,
  },
  supporting: {
    ...textTokens.supporting,
    flex: 1,
    minWidth: 0,
    color: colors.textSecondary,
  },
  addKey: {
    minWidth: 96,
  },
});
