import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Press } from "../../common/Press";
import { PageIntro } from "../../common/PageIntro";
import { Button } from "../../common/Button";
import { AppAlert } from "../../common/AppAlert";
import { toast } from "../../common/toastStore";
import { haptic } from "../../../design/haptics";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { styles } from "../styles";
import {
  SendTransferError,
  claimBrowserPairing,
  listPairedBrowsers,
  removePairedBrowser,
  type PairedBrowser,
} from "../../../services/sendTransfer";
import { currentFormatLocale } from "../../../i18n/formatLocale";

const CODE_LENGTH = 6;
const shortDate = (iso: string) =>
  new Date(Date.parse(iso)).toLocaleDateString(currentFormatLocale(), { month: "short", day: "numeric" });
const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);

/**
 * Send from a computer (founder, 2026-11-01): the Send web page shows a short
 * code, this page claims it, and that browser sends as this install (Pro
 * included) for 30 days. No account: the pairing is the proof. Paired
 * browsers are listed here, each with Remove.
 */
export function SettingsComputerView() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [browsers, setBrowsers] = useState<PairedBrowser[] | null>(null);
  const [listFailed, setListFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setBrowsers(await listPairedBrowsers());
      setListFailed(false);
    } catch {
      setListFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pair = async () => {
    if (code.length !== CODE_LENGTH || pairing) return;
    setPairing(true);
    try {
      await claimBrowserPairing(code);
      // Haptics vocabulary: `success` — a task completed.
      haptic.success();
      toast(t("sendComputer.paired"), "checkmark-circle-outline");
      setCode("");
      void refresh();
    } catch (error) {
      if (error instanceof SendTransferError && error.status === 404) {
        AppAlert.error(t("sendComputer.badCodeTitle"), t("sendComputer.badCodeBody"));
      } else {
        AppAlert.error(t("sendComputer.offlineTitle"), t("sendComputer.offlineBody"));
      }
    } finally {
      setPairing(false);
    }
  };

  const remove = async (browser: PairedBrowser) => {
    try {
      await removePairedBrowser(browser.id);
      // Haptics vocabulary: `light` — a small confirmation.
      haptic.light();
      toast(t("sendComputer.removed"), "close-circle-outline");
      setBrowsers((current) => current?.filter((item) => item.id !== browser.id) ?? null);
    } catch {
      AppAlert.error(t("sendComputer.offlineTitle"), t("sendComputer.offlineBody"));
    }
  };

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={local.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("sendComputer.title")} subtitle={t("sendComputer.intro")} />

      <View style={local.pairBlock}>
        <TextInput
          value={code}
          onChangeText={(value) => setCode(normalize(value))}
          onSubmitEditing={() => void pair()}
          placeholder={t("sendComputer.codePlaceholder")}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          returnKeyType="go"
          maxLength={CODE_LENGTH + 2}
          style={[local.codeInput, code ? local.codeTyped : null]}
          accessibilityLabel={t("sendComputer.codeA11y")}
          testID="send-computer-code"
        />
        <Button
          label={pairing ? t("sendComputer.pairing") : t("sendComputer.pair")}
          disabled={code.length !== CODE_LENGTH || pairing}
          onPress={() => void pair()}
          testID="send-computer-pair"
        />
      </View>

      {browsers && browsers.length > 0 ? (
        <View style={local.listBlock}>
          <Text style={styles.settingsSectionLabel}>{t("sendComputer.pairedLabel")}</Text>
          {browsers.map((browser) => (
            <View key={browser.id} style={local.row}>
              <Ionicons name="desktop-outline" size={18} color={colors.textStrong} />
              <View style={local.rowMain}>
                <Text style={local.rowTitle} numberOfLines={1}>
                  {browser.label}
                </Text>
                <Text style={local.rowMeta} numberOfLines={1}>
                  {t("sendComputer.pairedOn", { date: shortDate(browser.pairedAt) })}
                </Text>
              </View>
              <Press
                feel="glyph"
                onPress={() => void remove(browser)}
                hitSlop={10}
                style={local.rowAction}
                accessibilityRole="button"
                accessibilityLabel={t("sendComputer.removeA11y", { label: browser.label })}
              >
                <Ionicons name="close" size={17} color={colors.textMuted} />
              </Press>
            </View>
          ))}
        </View>
      ) : listFailed ? (
        <Text style={local.quiet}>{t("sendComputer.listFailed")}</Text>
      ) : null}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  content: {
    paddingBottom: 120,
    gap: spacing.lg,
  },
  pairBlock: {
    gap: spacing.md,
  },
  // One input shape for typed codes: the search field's quiet tonal fill.
  codeInput: {
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.md,
    ...textTokens.caption,
    fontSize: 20,
    textAlign: "center",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  // Spaced out only once typed, so the placeholder reads as a word.
  codeTyped: {
    fontSize: 24,
    letterSpacing: 6,
  },
  listBlock: {
    gap: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 56,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    ...textTokens.body,
    fontSize: 15,
  },
  rowMeta: {
    ...textTokens.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },
  rowAction: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  quiet: {
    ...textTokens.supporting,
    color: colors.textSecondary,
  },
});
