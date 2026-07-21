import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import type { MagpieStep } from "../../../types";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  step: MagpieStep;
  onClose: () => void;
};

export function MagpieHelpSheet({ visible, step, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView style={helpStyles.sheetScroll} showsVerticalScrollIndicator={false}>
        {step === "build" ? <BuildHelp /> : <PageHelp />}
      </ScrollView>
    </BottomSheet>
  );
}

function PageHelp() {
  const { t } = useTranslation();
  return (
    <>
      <Text style={helpStyles.title}>{t("magpieHelp.pageTitle")}</Text>
      <Text style={helpStyles.subtitle}>{t("magpieHelp.pageBody")}</Text>

      <View style={helpStyles.example}>
        <Text style={helpStyles.exampleLabel}>{t("magpieHelp.catchesEar")}</Text>
        <Text style={helpStyles.exampleText}>
          {t("magpieHelp.pageExampleBefore")}<Text style={helpStyles.exampleMark}>{t("magpieHelp.pageExampleMark1")}</Text>
          {t("magpieHelp.pageExampleMiddle")}<Text style={helpStyles.exampleMark}>{t("magpieHelp.pageExampleMark2")}</Text>
          {t("magpieHelp.pageExampleAfter")}
        </Text>
        <Text style={[helpStyles.exampleLabel, helpStyles.exampleLabelSecond]}>{t("magpieHelp.intoPile")}</Text>
        <Text style={helpStyles.exampleText}>{t("magpieHelp.pileExample")}</Text>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="refresh" title={t("magpieHelp.newPageTitle")} body={t("magpieHelp.newPageBody")} />
        <HelpPoint icon="shuffle" title={t("magpieHelp.newBookTitle")} body={t("magpieHelp.newBookBody")} />
        <HelpPoint icon="albums-outline" title={t("magpieHelp.pileKeepsTitle")} body={t("magpieHelp.pileKeepsBody")} />
      </View>

      <Text style={helpStyles.credit}>{t("magpieHelp.credit")}</Text>
    </>
  );
}

function BuildHelp() {
  const { t } = useTranslation();
  return (
    <>
      <Text style={helpStyles.title}>{t("magpieHelp.buildTitle")}</Text>
      <Text style={helpStyles.subtitle}>{t("magpieHelp.buildBody")}</Text>

      <View style={helpStyles.example}>
        <Text style={helpStyles.exampleLabel}>{t("magpieHelp.looseFragments")}</Text>
        <Text style={helpStyles.exampleText}>{t("magpieHelp.looseExample")}</Text>
        <Text style={[helpStyles.exampleLabel, helpStyles.exampleLabelSecond]}>{t("magpieHelp.worthKeeping")}</Text>
        <Text style={helpStyles.exampleText}>{t("magpieHelp.revisedExample")}</Text>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="reorder-three" title={t("magpieHelp.reorderTitle")} body={t("magpieHelp.reorderBody")} />
        <HelpPoint icon="cut-outline" title={t("magpieHelp.splitTitle")} body={t("magpieHelp.splitBody")} />
        <HelpPoint icon="bookmark-outline" title={t("magpieHelp.saveTitle")} body={t("magpieHelp.saveBody")} />
      </View>
    </>
  );
}

function HelpPoint({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={helpStyles.point}>
      <View style={helpStyles.pointIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={helpStyles.pointCopy}>
        <Text style={helpStyles.pointTitle}>{title}</Text>
        <Text style={helpStyles.pointBody}>{body}</Text>
      </View>
    </View>
  );
}

const helpStyles = StyleSheet.create({
  sheetScroll: { maxHeight: 540 },
  title: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 19, color: colors.textPrimary, marginBottom: 4 },
  subtitle: { ...textTokens.supporting, marginBottom: spacing.lg },
  example: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  exampleLabel: { ...textTokens.annotation },
  exampleLabelSecond: { marginTop: spacing.md },
  exampleText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  exampleMark: { backgroundColor: "#E4B7A6", color: "#5C2E1E" },
  credit: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  points: { gap: spacing.md },
  point: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  pointIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  pointCopy: { flex: 1, minWidth: 0, gap: 2 },
  pointTitle: { ...textTokens.body, fontFamily: "PlusJakartaSans_700Bold" },
  pointBody: { ...textTokens.supporting, fontSize: 12 },
});
