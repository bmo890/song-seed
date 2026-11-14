import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useHasProAccess, type ProFeature } from "../../domain/entitlements";
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
 * always agree; a call site never draws it by hand.
 *
 * Canon components take the mark themselves (`InkKey pro`, a `SegmentedControl`
 * option's `pro`, a `SelectionAction`'s `pro`); beside a plain label use `ProMark`.
 */
export function useProLocked(
  feature: ProFeature,
  options: { ideaId?: string | null; atLimit?: boolean } = {}
): boolean {
  const allowed = useHasProAccess(feature);
  if (allowed || options.atLimit === false) return false;
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
  style,
}: {
  feature: ProFeature;
  /** The song the control acts on: a received parcel's song uses the Pro tools free. */
  ideaId?: string | null;
  /** Count-based doors: false while the free allowance still has room. */
  atLimit?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return useProLocked(feature, { ideaId, atLimit }) ? <ProMarkText style={style} /> : null;
}

const s = StyleSheet.create({
  mark: {
    ...textTokens.annotation,
    color: colors.primaryDeep,
  },
});
