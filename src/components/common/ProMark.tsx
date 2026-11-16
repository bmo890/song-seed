import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useHasProAccess, usePlanState, type ProFeature } from "../../domain/entitlements";
import { isReceivedIdea } from "./proUpsell";
import { colors, text as textTokens } from "../../design/tokens";

/**
 * The Pro mark (founder, 2026-11-14: "make sure the relevant items are properly
 * marked as pro within the app ui"). A door that opens the Pro page says so before
 * it is tapped: the word "Pro" in the eyebrow's small capitals, terracotta ink, no
 * fill and no lock glyph, set after the control's own word.
 *
 * It shows only to someone the door would stop: never to a Pro member, in the free
 * month, on a received parcel's song (those tools are free there), or while a
 * count-based allowance still has room (`atLimit: false`). So the mark and the gate
 * always agree; a call site never draws it by hand. One exception, founder 2026-11-16:
 * a count door passing `markInFreeMonth` wears it in the free month once past the free
 * allowance (new workspaces), so the extra is labelled before the month ends.
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
  // A count door can wear the mark in the free month too (founder, 2026-11-16): a third
  // workspace made then is a Pro extra, kept for good, and should be labelled before
  // anyone relies on it. The gate still lets it through; only the mark shows.
  if (options.markInFreeMonth && options.atLimit && plan.kind === "freeMonth") return true;
  if (allowed) return false;
  return !isReceivedIdea(options.ideaId);
}

/** The mark itself, with no check: for a canon component whose caller already knows. */
export function ProMarkText({ style }: { style?: StyleProp<TextStyle> }) {
  const { t } = useTranslation();
  return (
    <Text style={[s.mark, style]} accessibilityLabel={t("pro.markA11y")}>
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
});
