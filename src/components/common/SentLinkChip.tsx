import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { colors, radii } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { toast } from "./toastStore";
import { useSentLinksStore } from "../../state/useSentLinksStore";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeftLabel(expiresAt: number, now: number, t: TFunction): string {
  const days = Math.ceil((expiresAt - now) / DAY_MS);
  if (days <= 0) return t("sharing.expiring");
  return t("sharing.daysLeft", { count: days });
}

/** On-entity provenance for a share link this device created: "Link active · N
 *  days left · Copy". A link is a SNAPSHOT of the entity at send time, so this
 *  says nothing about later edits — the menu's "Get a link" mints a fresh one.
 *  Renders nothing when there's no active (unexpired) link for the entity. */
export function SentLinkChip({ entityId }: { entityId: string }) {
  const { t } = useTranslation();
  const link = useSentLinksStore((s) => s.linkForEntity(entityId));
  if (!link) return null;

  const onCopy = () => {
    haptic.light();
    void Clipboard.setStringAsync(link.shareUrl).catch(() => {});
    toast(t("sharing.linkCopied"), "checkmark-outline");
  };

  return (
    <View style={styles.row}>
      <Ionicons name="link-outline" size={13} color={colors.textSecondary} />
      <Text style={styles.label} numberOfLines={1}>
        {t("sharing.linkActive", { time: daysLeftLabel(link.expiresAt, Date.now(), t) })}
      </Text>
      <Pressable
        onPress={onCopy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("sharing.copyLink")}
        style={({ pressed }) => [styles.copyBtn, pressed ? { opacity: 0.6 } : null]}
      >
        <Text style={styles.copyText}>{t("common.copy")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.round,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  copyBtn: {
    paddingHorizontal: 2,
  },
  copyText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: colors.primaryDeep,
  },
});
