import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Press } from "./Press";
import { Button } from "./Button";
import { AppAlert } from "./AppAlert";
import { SparkTextSizeSheet } from "./sparkTextScale";
import { dirIcon } from "../../design/directionalIcons";
import { haptic } from "../../design/haptics";
import { colors, spacing } from "../../design/tokens";
import { useTranslation } from "react-i18next";

/**
 * The frame every Lyric Spark wears (2026-10-17, founder picked A): the same
 * paper as the rest of the app, a compact tool bar with one "…", the steps as
 * ink tabs, and one footer with a quiet way back and a soft key named after
 * the next step. Word Ladder, Cut-Up and Borrowed Words were three copies of
 * this and had drifted apart; now there is one.
 */

/** The page a spark sits on: the app's paper. */
export const SPARK_PAPER = colors.page;

export function SparkHeader({
  title,
  onBack,
  onHelp,
  onDelete,
  menuTitle,
}: {
  title: string;
  onBack: () => void;
  /** "How it works": the method's help for the current step. */
  onHelp: () => void;
  onDelete: () => void;
  /** Names what the "…" acts on (the spark's own title when it has one). */
  menuTitle?: string;
}) {
  const { t } = useTranslation();
  const [sizeOpen, setSizeOpen] = useState(false);
  const openMenu = () => {
    // Order: act on it, then destroy (the menu law).
    AppAlert.menu(menuTitle || title, [
      {
        key: "size",
        label: t("wordSparks.textSize"),
        icon: "text-outline",
        onPress: () => setSizeOpen(true),
      },
      {
        key: "help",
        label: t("wordSparks.howThisWorks"),
        icon: "help-circle-outline",
        onPress: onHelp,
      },
      {
        key: "delete",
        label: t("wordSparks.deleteSpark"),
        icon: "trash-outline",
        tone: "danger",
        onPress: onDelete,
      },
    ]);
  };
  return (
    <View style={s.header}>
      <Press
        // Haptics vocabulary: navigation is silent.
        haptic="navigate"
        feel="glyph"
        style={s.headerKey}
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <Ionicons name={dirIcon("chevron-back")} size={22} color={colors.textStrong} />
      </Press>
      <Text style={s.title} numberOfLines={1}>
        {title}
      </Text>
      <Press
        feel="glyph"
        style={s.headerKey}
        onPress={openMenu}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.moreOptions")}
      >
        <Ionicons name="ellipsis-horizontal" size={22} color={colors.textStrong} />
      </Press>
      <SparkTextSizeSheet visible={sizeOpen} onClose={() => setSizeOpen(false)} />
    </View>
  );
}

/** The steps as ink tabs: the current one in full ink over a 2 pt rule, the
 *  ones behind in secondary, the ones ahead muted. Wayfinding, not controls. */
export function SparkSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={s.steps} accessibilityRole="tablist">
      {steps.map((label, index) => {
        const isCurrent = index === current;
        return (
          <View
            key={label}
            style={[s.step, isCurrent ? s.stepCurrent : null]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isCurrent }}
          >
            <Text
              style={[s.stepText, index < current ? s.stepDone : null, isCurrent ? s.stepTextCurrent : null]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The one footer: an optional short hint, a quiet "‹ Step" back, and the soft
 * key. Next taps; the last step's Save is a completion (`success`).
 */
export function SparkFooter({
  back,
  next,
  hint,
}: {
  back?: { label: string; onPress: () => void };
  next: { label: string; onPress: () => void; disabled?: boolean; final?: boolean };
  hint?: string | null;
}) {
  return (
    <View style={s.footer}>
      {hint ? (
        <Text style={s.hint} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
      <View style={s.footerRow}>
        {back ? (
          <Press
            // Haptics vocabulary: tap, an acknowledged press.
            feel="glyph"
            style={s.back}
            onPress={back.onPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={back.label}
          >
            <Ionicons name={dirIcon("chevron-back")} size={15} color={colors.textStrong} />
            <Text style={s.backText}>{back.label}</Text>
          </Press>
        ) : (
          <View />
        )}
        <Button
          label={next.label}
          disabled={next.disabled}
          hapticFeedback={!next.final}
          onPress={() => {
            // Haptics vocabulary: success, a meaningful completion.
            if (next.final) haptic.success();
            next.onPress();
          }}
          style={s.nextKey}
        />
      </View>
    </View>
  );
}

/** The spark paper's empty/missing state, shared. */
export function SparkMissing({
  title,
  body,
  icon,
  onBack,
}: {
  title: string;
  body: string;
  icon: ReactNode;
  /** Always a way out (it used to be a dead end without one). */
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.missingPage}>
      <View style={s.header}>
        <Press
          haptic="navigate"
          feel="glyph"
          style={s.headerKey}
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Ionicons name={dirIcon("chevron-back")} size={22} color={colors.textStrong} />
        </Press>
      </View>
      <View style={s.missing}>
        {icon}
        <Text style={s.missingTitle}>{title}</Text>
        <Text style={s.missingBody}>{body}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
  },
  headerKey: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Lora_500Medium",
    fontSize: 19,
    color: colors.textPrimary,
  },
  steps: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
    marginBottom: spacing.lg,
  },
  step: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
  },
  stepCurrent: {
    borderBottomWidth: 2,
    borderBottomColor: colors.textPrimary,
    marginBottom: -StyleSheet.hairlineWidth,
  },
  stepText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textMuted,
  },
  stepDone: {
    color: colors.textSecondary,
  },
  stepTextCurrent: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
  footer: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  hint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 40,
  },
  backText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textStrong,
  },
  nextKey: {
    minWidth: 104,
  },
  missingPage: {
    flex: 1,
  },
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
  },
  missingTitle: {
    fontFamily: "Lora_500Medium",
    fontSize: 18,
    color: colors.textPrimary,
  },
  missingBody: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
