import { Fragment, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Press } from "./Press";
import { Button } from "./Button";
import { AppAlert } from "./AppAlert";
import { InkLink } from "./InkLink";
import { SparkTextSizeSheet } from "./sparkTextScale";
import { dirIcon } from "../../design/directionalIcons";
import { haptic } from "../../design/haptics";
import { colors, radii, spacing } from "../../design/tokens";
import { durations } from "../../design/motion";
import { CHEVRON, ROW_GAP, STEP_GAP, STEP_NUM, visibleStepLabels } from "../../domain/stepLabels";
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
  onSend,
  menuTitle,
}: {
  title: string;
  onBack: () => void;
  /** "How it works": the method's help for the current step. */
  onHelp: () => void;
  onDelete: () => void;
  /** Copies the spark's lyric into the Lyric Pad (the spark stays). */
  onSend?: () => void;
  /** Names what the "…" acts on (the spark's own title when it has one). */
  menuTitle?: string;
}) {
  const { t } = useTranslation();
  const [sizeOpen, setSizeOpen] = useState(false);
  const openMenu = () => {
    // Order: act on it, send it out, then destroy (the menu law).
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
      ...(onSend
        ? [
            {
              key: "send",
              label: t("wordSparks.sendToPad"),
              icon: "document-text-outline" as const,
              onPress: onSend,
            },
          ]
        : []),
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

/**
 * The steps as a numbered path (2026-10-17, founder: a beginning and an end,
 * like a form): 1 › 2 › 3. The current step is a filled ink number, a finished
 * one a check, the ones ahead hollow and muted. Every name shows when they fit;
 * when they don't, names drop from the steps furthest from yours first, so the
 * row never truncates to "Ve… No…" (the responsive-stepper pattern). It is
 * wayfinding, not a control: nothing here is tappable; the footer moves you.
 */
export function SparkSteps({ steps, current }: { steps: string[]; current: number }) {
  const { t } = useTranslation();
  const [rowWidth, setRowWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<Array<number | undefined>>(() => steps.map(() => undefined));
  const measured = rowWidth > 0 && labelWidths.every((w) => w !== undefined);
  // Until everything is measured, only the current name shows (never a flash
  // of truncated names).
  const shown = measured
    ? visibleStepLabels(labelWidths as number[], current, rowWidth)
    : steps.map((_, i) => i === current);
  return (
    <View
      style={s.steps}
      onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={t("wordSparks.stepOf", {
        current: current + 1,
        total: steps.length,
        name: steps[current] ?? "",
      })}
    >
      {/* Off-screen measure of each name at its widest (semibold) weight. */}
      <View style={s.measure} pointerEvents="none" importantForAccessibility="no-hide-descendants">
        {steps.map((label, index) => (
          <Text
            key={label}
            style={[s.stepText, s.stepTextCurrent]}
            onLayout={(e) => {
              const w = Math.ceil(e.nativeEvent.layout.width);
              setLabelWidths((prev) => (prev[index] === w ? prev : prev.map((v, i) => (i === index ? w : v))));
            }}
          >
            {label}
          </Text>
        ))}
      </View>
      {steps.map((label, index) => {
        const isCurrent = index === current;
        const isDone = index < current;
        return (
          <Fragment key={label}>
            {index > 0 ? (
              <Ionicons name={dirIcon("chevron-forward")} size={CHEVRON} color={colors.borderMuted} />
            ) : null}
            <View style={s.step}>
              <View style={[s.stepNum, isCurrent ? s.stepNumCurrent : isDone ? s.stepNumDone : null]}>
                {isDone ? (
                  <Ionicons name="checkmark" size={12} color={colors.textSecondary} />
                ) : (
                  <Text style={[s.stepNumText, isCurrent ? s.stepNumTextCurrent : null]}>{index + 1}</Text>
                )}
              </View>
              {shown[index] ? (
                <Text
                  style={[s.stepText, isDone ? s.stepDone : null, isCurrent ? s.stepTextCurrent : null]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              ) : null}
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

/**
 * A step teaching itself (2026-10-17): one plain line where the work will go,
 * and a quiet link to the method's example. The caller shows it only while the
 * step is empty, so it leaves the moment you start: there for a newcomer,
 * gone in a second for someone who knows the method.
 */
export function SparkHint({ text, onExample }: { text: string; onExample: () => void }) {
  const { t } = useTranslation();
  return (
    <Animated.View
      entering={FadeIn.duration(durations.base)}
      exiting={FadeOut.duration(durations.fast)}
      style={s.hintBlock}
    >
      <Text style={s.hintText}>{text}</Text>
      <InkLink label={t("wordSparks.seeExample")} onPress={onExample} />
    </Animated.View>
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
  link,
}: {
  back?: { label: string; onPress: () => void };
  next: { label: string; onPress: () => void; disabled?: boolean; final?: boolean };
  hint?: string | null;
  /** A quiet way onward beside the step's own key (the last step's "Send to
   *  Lyric Pad", or "In Lyric Pad" once sent). */
  link?: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap };
}) {
  return (
    <View style={s.footer}>
      {hint ? (
        <Text style={s.hint} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
      {link ? <InkLink label={link.label} icon={link.icon} onPress={link.onPress} /> : null}
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
    alignItems: "center",
    justifyContent: "space-between",
    gap: ROW_GAP,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
    marginBottom: spacing.lg,
  },
  measure: {
    position: "absolute",
    opacity: 0,
    flexDirection: "row",
    left: 0,
    top: 0,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: STEP_GAP,
    flexShrink: 1,
    minWidth: 0,
  },
  stepNum: {
    width: STEP_NUM,
    height: STEP_NUM,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumCurrent: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  stepNumDone: {
    borderColor: "transparent",
  },
  // Proportional figures and a fixed line box: tabular "1" sat left of centre
  // and the font's tall ascender pushed every digit low in the dot.
  stepNumText: {
    width: STEP_NUM,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
    includeFontPadding: false,
    color: colors.textMuted,
  },
  stepNumTextCurrent: {
    color: colors.page,
  },
  stepText: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textMuted,
  },
  stepTextCurrent: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
  stepDone: {
    color: colors.textSecondary,
  },
  hintBlock: {
    paddingVertical: spacing.sm,
  },
  hintText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
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
