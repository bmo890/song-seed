import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useHasProAccess, usePlanState, type ProFeature } from "../../domain/entitlements";
import { isProFeature } from "../../domain/proCatalog";
import { isReceivedIdea } from "./proUpsell";
import { colors, text as textTokens } from "../../design/tokens";

/**
 * The Pro mark (founder, 2026-11-14: "make sure the relevant items are properly
 * marked as pro within the app ui"). A door that opens the Pro page says so before
 * it is tapped: the word "Pro" in the eyebrow's small capitals, terracotta ink, no
 * fill and no lock glyph, set after the control's own word.
 *
 * It shows to someone the door would stop, and (founder, 2026-11-25: "people need to
 * know what the features are that will be pro") in the free month too, in quiet grey
 * ink: the door still opens, the mark only says what it will be. Never to a Pro member
 * or a founding install, on a received parcel's song (those tools are free there), or
 * while a count-based allowance still has room (`atLimit: false`). A call site never
 * draws it by hand.
 *
 * Canon components take the mark themselves (`InkKey pro`, a `SegmentedControl`
 * option's `pro`, a `SelectionAction`'s `pro`); beside a plain label use `ProMark`.
 */
export function useProLocked(
  feature: ProFeature,
  options: { ideaId?: string | null; atLimit?: boolean; markInFreeMonth?: boolean } = {}
): boolean {
  const allowed = useHasProAccess(feature);
  const plan = usePlanState();
  if (options.atLimit === false) return false;
  if (isReceivedIdea(options.ideaId)) return false;
  // The free month is the only reason this door opens: mark it anyway, quietly
  // (ProMarkText greys it), so the month shows what Pro is.
  if (plan.kind === "freeMonth") return isProFeature(feature);
  return !allowed;
}

/** The mark itself, with no check: for a canon component whose caller already knows.
 *  In the free month it is grey (what it will be); after, terracotta (what it is). */
export function ProMarkText({ style }: { style?: StyleProp<TextStyle> }) {
  const { t } = useTranslation();
  const trial = usePlanState().kind === "freeMonth";
  return (
    <Text style={[s.mark, trial ? s.trial : null, style]} accessibilityLabel={t("pro.markA11y")}>
      {t("pro.mark")}
    </Text>
  );
}

export function ProMark({
  feature,
  ideaId,
  atLimit,
  markInFreeMonth,
  style,
}: {
  feature: ProFeature;
  /** The song the control acts on: a received parcel's song uses the Pro tools free. */
  ideaId?: string | null;
  /** Count-based doors: false while the free allowance still has room. */
  atLimit?: boolean;
  /** With `atLimit`: also mark the door in the free month, where the gate lets it by. */
  markInFreeMonth?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return useProLocked(feature, { ideaId, atLimit, markInFreeMonth }) ? <ProMarkText style={style} /> : null;
}

const s = StyleSheet.create({
  mark: {
    ...textTokens.annotation,
    color: colors.primaryDeep,
  },
  trial: {
    color: colors.textMuted,
  },
});
